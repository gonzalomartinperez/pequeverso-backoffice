import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import fc from "fast-check";
import { defaultSelection, profile } from "../../src/features/analytics/domain/report.ts";
import { reportSelection } from "../../src/features/analytics/domain/selection.ts";
import {
  type Action,
  can,
  invitationState,
  normalizeEmail,
  type Role,
} from "../../src/features/auth/domain/access.ts";
import { parseOpsSummary } from "../../src/features/operations/adapters/validate.ts";
import {
  acceptedRuns,
  addMoney,
  budgetUse,
  percent,
} from "../../src/features/operations/domain/summary.ts";
import { propertyOptions } from "./support/property.ts";

const options = propertyOptions("property");
const actions = ["read_operations", "manage_access"] as const;
const roles = ["owner", "viewer", null, undefined] as const;
const unknownName = fc.oneof(fc.string(), fc.constantFrom("__proto__", "constructor", "toString"));

test("permission lattice is total, deterministic and monotonic on supported roles/actions", () => {
  fc.assert(
    fc.property(fc.shuffledSubarray([...actions], { minLength: 2 }), (order) => {
      for (const action of order) {
        for (const role of roles) {
          const result = can(role, action);
          assert.equal(typeof result, "boolean");
          assert.equal(can(role, action), result);
          assert.equal(
            result,
            role === "owner" || (role === "viewer" && action === "read_operations"),
          );
        }
        if (can("viewer", action)) assert.equal(can("owner", action), true);
      }
    }),
    options,
  );
});

test("unknown actions are denied", () => {
  fc.assert(
    fc.property(
      unknownName.filter((value) => !actions.includes(value as Action)),
      (action) => {
        for (const role of roles) assert.equal(can(role, action as Action), false);
      },
    ),
    options,
  );
});

test("unknown roles are denied, including prototype keys", () => {
  fc.assert(
    fc.property(
      unknownName.filter((value) => value !== "owner" && value !== "viewer"),
      (role) => {
        for (const action of actions) assert.equal(can(role as Role, action), false);
      },
    ),
    options,
  );
});

test("invitation precedence is revoked > accepted > expired > pending, including exact expiry", () => {
  fc.assert(
    fc.property(
      fc.boolean(),
      fc.boolean(),
      fc.integer({ min: -100000, max: 100000 }),
      (revoked, accepted, delta) => {
        const now = new Date("2026-11-14T12:00:00Z");
        const invitation = {
          id: "synthetic",
          email: "viewer@example.com",
          role: "viewer" as const,
          createdAt: new Date("2026-11-12T12:00:00Z"),
          expiresAt: new Date(now.getTime() + delta),
          revokedAt: revoked ? now : null,
          acceptedAt: accepted ? now : null,
        };
        assert.equal(
          invitationState(invitation, now),
          revoked ? "revoked" : accepted ? "accepted" : delta <= 0 ? "expired" : "pending",
        );
        assert.equal(
          invitationState(
            { ...invitation, revokedAt: null, acceptedAt: null, expiresAt: now },
            now,
          ),
          "expired",
        );
      },
    ),
    options,
  );
});

test("email normalization is idempotent for arbitrary and valid email spellings", () => {
  const email = fc.oneof(
    fc.string(),
    fc.emailAddress().map((value) => `  ${value.toUpperCase()}  `),
    fc.constant(null),
    fc.constant(undefined),
  );
  fc.assert(
    fc.property(email, (raw) => {
      const normalized = normalizeEmail(raw);
      assert.equal(normalizeEmail(normalized), normalized);
    }),
    options,
  );
});

// selection.ts accepts a Next search-param record; there is no domain serializer today.
const toParams = (selection: object) =>
  new URLSearchParams(Object.entries(selection).map(([key, value]) => [key, String(value)]));
test("valid analytics selections survive URL serialization and canonicalization", () => {
  const routeSection = fc.constantFrom(
    ...Object.entries(profile).flatMap(([route, sections]) =>
      ["all", ...sections].map((section_id) => ({ route, section_id })),
    ),
    { route: "all", section_id: "all" },
  );
  fc.assert(
    fc.property(
      routeSection,
      fc.constantFrom("day", "week", "month"),
      fc.integer({ min: 0, max: 2 }),
      fc.constantFrom("all", "mobile", "tablet", "desktop"),
      (pair, period, offset, viewport_bucket) => {
        const selection = { ...defaultSelection, ...pair, period, offset, viewport_bucket };
        const parsed = reportSelection(Object.fromEntries(toParams(selection)));
        assert.deepEqual(parsed, selection);
        const serialized = toParams(parsed ?? {}).toString();
        assert.equal(
          toParams(
            reportSelection(Object.fromEntries(new URLSearchParams(serialized))) ?? {},
          ).toString(),
          serialized,
        );
      },
    ),
    options,
  );
});

test("analytics selection parsing never throws for arbitrary query strings or records", () => {
  fc.assert(
    fc.property(
      fc.string(),
      fc.dictionary(
        fc.string(),
        fc.oneof(fc.string(), fc.array(fc.string()), fc.constant(undefined)),
      ),
      (query, record) => {
        for (const input of [Object.fromEntries(new URLSearchParams(query)), record]) {
          const parsed = reportSelection(input);
          if (parsed !== null)
            assert.deepEqual(reportSelection(Object.fromEntries(toParams(parsed))), parsed);
        }
      },
    ),
    options,
  );
});

const micro = fc.integer({ min: 0, max: 999999999 });
const money = (value: number) =>
  `${Math.floor(value / 1000000)}.${String(value % 1000000).padStart(6, "0")}`;
test("money sums reconcile exactly, are finite/non-negative and propagate missing values", () => {
  fc.assert(
    fc.property(fc.array(micro, { maxLength: 12 }), (values) => {
      const sum = addMoney(...values.map(money));
      assert.equal(sum, money(values.reduce((total, value) => total + value, 0)));
      assert.ok(Number.isFinite(Number(sum)) && Number(sum) >= 0);
      assert.equal(addMoney(...values.map(money), null), null);
    }),
    options,
  );
});

test("percentages and accepted run sums are finite/non-negative and preserve missing values", () => {
  fc.assert(
    fc.property(micro, fc.integer({ min: 1, max: 999999999 }), (part, whole) => {
      const value = percent(part, whole);
      assert.ok(value !== null && Number.isFinite(value) && value >= 0);
      assert.equal(percent(null, whole), null);
      assert.equal(percent(part, null), null);
      assert.equal(percent(part, 0), null);
      const runs = { completed: part, failed: whole, cancelled: 0, interrupted: 0, refused: 0 };
      assert.equal(acceptedRuns(runs), part + whole);
      assert.equal(acceptedRuns({ ...runs, cancelled: null }), null);
    }),
    options,
  );
});

test("budget percentage uses all spend components and preserves missing values", () => {
  const baseline = parseOpsSummary(
    JSON.parse(readFileSync("contracts/ops/ops.summary.example.json", "utf8")),
  );
  assert.ok(baseline.budget);
  const budget = baseline.budget;
  fc.assert(
    fc.property(
      micro,
      micro,
      micro,
      fc.integer({ min: 1, max: 999999999 }),
      (confirmed, estimated, pending, limit) => {
        const summary = {
          ...baseline,
          budget: {
            ...budget,
            monthlyLimit: money(limit),
            monthSpend: {
              confirmed: money(confirmed),
              estimated: money(estimated),
              pending: money(pending),
            },
          },
        };
        const use = budgetUse(summary);
        assert.ok(use !== null && Number.isFinite(use) && use >= 0);
        assert.ok(
          Math.abs(use - ((confirmed + estimated + pending) / limit) * 100) <=
            1e-6 * Math.max(1, use),
        );
        assert.equal(budgetUse({ ...summary, budget: null }), null);
        assert.equal(
          budgetUse({ ...summary, budget: { ...summary.budget, monthlyLimit: null } }),
          null,
        );
        for (const key of ["confirmed", "estimated", "pending"] as const)
          assert.equal(
            budgetUse({
              ...summary,
              budget: {
                ...summary.budget,
                monthSpend: { ...summary.budget.monthSpend, [key]: null },
              },
            }),
            null,
          );
      },
    ),
    options,
  );
});
