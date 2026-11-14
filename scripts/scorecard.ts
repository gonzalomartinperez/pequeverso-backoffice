// Scorecard: aggregates the ratchet files, repo-local measurements and optional CI artifacts into
// scorecard.json (docs/master-plan/scorecard.md). A value always comes from a command or an artifact;
// an axis without one is a named gap, never a number. Exits 1 on regression against a ratchet.
//
//   node scripts/scorecard.ts [--out scorecard.json] [--coverage coverage-summary.json]
//     [--bundle bundle-report.json] [--lighthouse lighthouse-summary.json]
//     [--base origin/develop]   fail when a ratchet is looser than at that base revision
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { measure, readBaseRatchet, resolveBase, type Summary } from "./check-coverage.ts";

export type AxisId = (typeof AXES)[number][0];
type Better = "lower" | "higher";
type Gap = { axis: AxisId; id: string; reason: string; plannedIn: string };
export type Reading = {
  axis: AxisId;
  id: string;
  value: number;
  ratchet: number | null;
  better: Better;
  mode: "enforce" | "warn";
};
type Json = Record<string, unknown>;
export type Ratchets = Record<string, Json>;
export type Inputs = {
  ratchets: Ratchets;
  local: Record<string, number>;
  coverage?: Json;
  bundle?: Json;
  lighthouse?: Json;
};

export const AXES = [
  ["D1", "Architecture"],
  ["D2", "Code quality"],
  ["D3", "Tests"],
  ["D4", "CI/CD"],
  ["D5", "Security and supply chain"],
  ["D6", "Performance"],
  ["D7", "Observability"],
  ["D8", "Docs and DX"],
  ["P1", "Visual design and system"],
  ["P2", "Interaction and motion"],
  ["P3", "Accessibility"],
  ["P4", "Responsive and cross-browser"],
  ["P5", "Theme parity"],
  ["P6", "Consistency and identity"],
  ["O1", "Answer first"],
  ["O2", "Honesty"],
  ["O3", "Plain language"],
  ["O4", "Safe administration"],
  ["O5", "Speed to task"],
] as const;

/** Repo-local measurements: [axis, metric id, ratchet file, ratchet key]. All lower is better. */
export const LOCAL: [AxisId, string, string, string][] = [
  ["D1", "guard.violations", "guard", "violations"],
  ["D2", "types.errors", "types", "errors"],
  ["D2", "lint.suppressions", "lint", "suppressions"],
  ["D8", "docs.missingLinks", "docs", "missingLinks"],
];

const judged = "judgement axis: scored by the independent evaluator, no automatic measurement";
const g = (axis: AxisId, id: string, reason: string, plannedIn: string): Gap => ({
  axis,
  id,
  reason,
  plannedIn,
});
/** Named gaps: planned measurements with no producer yet. Each leaves this list when it lands. */
export const GAPS: Gap[] = [
  g("D2", "complexity.max", "no complexity metric or ratchet yet", "M4.8"),
  g("D3", "mutation.score", "Stryker mutation run not wired", "M2.2"),
  g("D3", "flake.count", "no flake detector data", "M2.5"),
  g("D4", "ci-duration.p50", "no CI duration report", "M6.3"),
  g("D7", "observability.checks", "request-id propagation and SLO tests do not exist", "M4.7"),
  g("P1", "tokens.literals", "no token or literal lint", "M5.1"),
  g("P2", "states.coverage", "no state fixtures or motion token test", "M5.9"),
  g("P3", "a11y.axe", "axe-per-route evidence is not an automatic metric yet", "M5.9"),
  g("P4", "visual.diff", "no approved visual baseline", "M5.9"),
  g("P5", "parity.delta", "no per-theme evidence", "M5.9"),
  g("P6", "kit.lock", "no shared kit lock", "M5.1"),
  g("O1", "evaluator.answer-first", judged, "M5.3"),
  g("O2", "evaluator.honesty", judged, "M5.10"),
  g("O3", "evaluator.plain-language", judged, "M5.10"),
  g("O4", "evaluator.safe-administration", judged, "M5.5"),
  g("O5", "evaluator.speed-to-task", judged, "M5.2"),
];

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const need = (v: unknown, label: string): number => {
  const n = num(v);
  if (n === null) throw new Error(`${label} is missing or not a finite number`);
  return n;
};
const modeOf = (file: Json | undefined): Reading["mode"] =>
  file?.mode === "warn" ? "warn" : "enforce";

/** `{status:"gap", reason, plannedIn}` entries of a ratchet file become named gaps of that axis. */
function ratchetGaps(ratchets: Ratchets): Gap[] {
  const out: Gap[] = [];
  for (const [id, value] of Object.entries(ratchets.security ?? {}))
    if (isObject(value) && value.status === "gap")
      out.push(g("D5", `security.${id}`, String(value.reason), String(value.plannedIn)));
  return out;
}

const pending = (axis: AxisId, id: string, plannedIn: string): Gap =>
  g(axis, id, "CI artifact not supplied to this run", plannedIn);

/** Ratchet value that must exist: a missing or non-numeric limit is an error, never "unmeasured". */
const limit = (file: Json | undefined, key: string, label: string): number =>
  need(file?.[key], `ratchet ${label}`);

const LOWER = new Set(["tbtMs", "lcpMs", "fcpMs", "cls"]);
const HIGHER = new Set(["performance", "accessibility", "bestPractices"]);
/** Direction of a Lighthouse metric; an unknown key is an error, not a guess. */
export const lighthouseBetter = (key: string): Better => {
  if (LOWER.has(key)) return "lower";
  if (HIGHER.has(key)) return "higher";
  throw new Error(`unknown Lighthouse metric "${key}": add it to the direction table`);
};

const reading = (
  axis: AxisId,
  id: string,
  value: unknown,
  ratchet: number,
  better: Better,
  file: Json | undefined,
): Reading => ({ axis, id, value: need(value, id), ratchet, better, mode: modeOf(file) });

function bundleReadings(artifact: Json, ratchet: Json | undefined): Reading[] {
  const base = ratchet?.baseline;
  if (!isObject(base) || !isObject(base.routes) || Object.keys(base.routes).length === 0)
    throw new Error(
      "--bundle was supplied but quality/ratchets/bundle.json has no baseline routes",
    );
  if (!Array.isArray(artifact.routes)) throw new Error("bundle artifact has no routes array");
  const sizes = new Map<string, unknown>(
    (artifact.routes as Json[]).map((r) => [String(r.route), r.gzBytes]),
  );
  const out = Object.entries(base.routes).map(([route, max]) => {
    if (!sizes.has(route)) throw new Error(`bundle artifact lacks the baseline route ${route}`);
    return reading(
      "D6",
      `bundle.route.${route}`,
      sizes.get(route),
      need(max, route),
      "lower",
      ratchet,
    );
  });
  const fonts = isObject(artifact.fonts) ? artifact.fonts.bytes : undefined;
  const recharts = isObject(artifact.recharts) ? artifact.recharts.gzBytes : undefined;
  out.push(
    reading(
      "D6",
      "bundle.fontsBytes",
      fonts,
      limit(base, "fontsBytes", "bundle.fontsBytes"),
      "lower",
      ratchet,
    ),
    reading(
      "D6",
      "bundle.rechartsGzBytes",
      recharts,
      limit(base, "rechartsGzBytes", "bundle.rechartsGzBytes"),
      "lower",
      ratchet,
    ),
  );
  return out;
}

function lighthouseReadings(artifact: Json, ratchet: Json | undefined): Reading[] {
  const scenarios = ratchet?.baseline;
  if (!isObject(scenarios) || Object.keys(scenarios).length === 0)
    throw new Error(
      "--lighthouse was supplied but quality/ratchets/lighthouse.json has no baseline",
    );
  if (artifact.complete !== true || !isObject(artifact.results))
    throw new Error("lighthouse artifact is incomplete or has no results");
  const out: Reading[] = [];
  for (const [name, baseline] of Object.entries(scenarios)) {
    const entry = (artifact.results as Json)[name];
    const median = isObject(entry) && isObject(entry.median) ? entry.median : null;
    if (!median || !isObject(baseline)) throw new Error(`lighthouse artifact lacks ${name}`);
    for (const [key, max] of Object.entries(baseline))
      out.push(
        reading(
          "D6",
          `lighthouse.${name}.${key}`,
          median[key],
          need(max, `${name}.${key}`),
          lighthouseBetter(key),
          ratchet,
        ),
      );
  }
  return out;
}

export function readings(input: Inputs): { readings: Reading[]; gaps: Gap[] } {
  const { ratchets, local } = input;
  const out: Reading[] = [];
  const gaps = [...GAPS, ...ratchetGaps(ratchets)];
  for (const [axis, id, file, key] of LOCAL)
    out.push(
      reading(
        axis,
        id,
        local[id],
        limit(ratchets[file], key, `${file}.${key}`),
        "lower",
        ratchets[file],
      ),
    );

  if (input.coverage) {
    const m = measure(input.coverage as Summary, `${process.cwd()}/`);
    for (const key of ["branchRepo", "branchAuth", "linesStore"] as const)
      out.push(
        reading(
          "D3",
          `coverage.${key}`,
          m[key],
          limit(ratchets.coverage, key, `coverage.${key}`),
          "higher",
          ratchets.coverage,
        ),
      );
  } else gaps.push(pending("D3", "coverage", "M2.1"));

  if (input.bundle) out.push(...bundleReadings(input.bundle, ratchets.bundle));
  else gaps.push(pending("D6", "bundle", "M2.8"));
  if (input.lighthouse) out.push(...lighthouseReadings(input.lighthouse, ratchets.lighthouse));
  else gaps.push(pending("D6", "lighthouse", "M2.8"));
  return { readings: out, gaps };
}

const status = (r: Reading) => {
  if (r.ratchet === null) return "measured";
  const worse = r.better === "lower" ? r.value > r.ratchet : r.value < r.ratchet;
  return worse ? (r.mode === "warn" ? "warn" : "fail") : "pass";
};

export function buildScorecard(input: Inputs, meta: { commit: string | null; now: Date }) {
  const { readings: rs, gaps } = readings(input);
  const axes: Json = {};
  let regressions = 0;
  let warnings = 0;
  for (const [id, name] of AXES) {
    const metrics = [
      ...rs
        .filter((r) => r.axis === id)
        .map((r) => ({
          id: r.id,
          status: status(r),
          value: r.value,
          ratchet: r.ratchet,
          better: r.better,
        })),
      ...gaps
        .filter((x) => x.axis === id)
        .map((x) => ({ id: x.id, status: "gap", reason: x.reason, plannedIn: x.plannedIn })),
    ];
    const has = (s: string) => metrics.some((m) => m.status === s);
    regressions += metrics.filter((m) => m.status === "fail").length;
    warnings += metrics.filter((m) => m.status === "warn").length;
    const axisStatus = has("fail")
      ? "fail"
      : has("warn")
        ? "warn"
        : metrics.every((m) => m.status === "gap")
          ? "gap"
          : "pass";
    axes[id] = { name, status: axisStatus, metrics };
  }
  return {
    schemaVersion: 1,
    generatedAt: meta.now.toISOString(),
    commit: meta.commit,
    axes,
    summary: { regressions, warnings, gaps: gaps.length, measured: rs.length },
  };
}

/** Minimal JSON Schema subset ($ref, type, enum, const, required, properties, items, oneOf, additionalProperties). */
export function validate(schema: Json, value: unknown, at = "$", root: Json = schema): string[] {
  if (typeof schema.$ref === "string") {
    const target = schema.$ref
      .replace("#/", "")
      .split("/")
      .reduce<unknown>((n, k) => (n as Json)?.[k], root);
    return isObject(target)
      ? validate(target, value, at, root)
      : [`${at}: unresolved ${schema.$ref}`];
  }
  const errors: string[] = [];
  const type = schema.type as string | undefined;
  const actual = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  const ok = (t: string) => t === actual || (t === "integer" && Number.isInteger(value));
  const types = type ? [type].flat() : [];
  if (types.length && !types.some(ok)) return [`${at}: expected ${types.join("|")}, got ${actual}`];
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) errors.push(`${at}: not in enum`);
  if ("const" in schema && schema.const !== value)
    errors.push(`${at}: must be ${String(schema.const)}`);
  if (Array.isArray(schema.oneOf)) {
    const hits = schema.oneOf.filter(
      (s) => validate(s as Json, value, at, root).length === 0,
    ).length;
    if (hits !== 1) errors.push(`${at}: matches ${hits} of oneOf, expected 1`);
  }
  if (isObject(value)) {
    const props = isObject(schema.properties) ? schema.properties : {};
    for (const key of (schema.required as string[] | undefined) ?? [])
      if (!(key in value)) errors.push(`${at}.${key}: required`);
    for (const [key, sub] of Object.entries(props))
      if (key in value) errors.push(...validate(sub as Json, value[key], `${at}.${key}`, root));
    if (schema.additionalProperties === false)
      for (const key of Object.keys(value))
        if (!(key in props)) errors.push(`${at}.${key}: not allowed`);
  }
  if (Array.isArray(value) && isObject(schema.items))
    for (const [i, item] of value.entries())
      errors.push(...validate(schema.items as Json, item, `${at}[${i}]`, root));
  if (
    typeof value === "string" &&
    typeof schema.pattern === "string" &&
    !new RegExp(schema.pattern).test(value)
  )
    errors.push(`${at}: does not match ${schema.pattern}`);
  return errors;
}

export function loadRatchets(dir: string): Ratchets {
  const out: Ratchets = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")))
    out[file.slice(0, -5)] = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Json;
  return out;
}

const SUPPRESSION = /^\s*(?:\/\/|\{?\/\*)\s*biome-ignore\b/;
export function countSuppressions(root: string): number {
  let count = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name))
        count += readFileSync(full, "utf8")
          .split("\n")
          .filter((l) => SUPPRESSION.test(l)).length;
    }
  };
  for (const dir of ["src", "tests", "scripts"]) walk(path.join(root, dir));
  return count;
}

export type Run = { status: number | null; error?: Error | undefined; out: string };
export type Runner = (args: string[]) => Run;
export const run: Runner = (args) => {
  const r = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, error: r.error, out: `${r.stdout}\n${r.stderr}` };
};

/** A command that crashed, was killed, or failed without a countable finding is an error, not 0. */
function counted(r: Run, count: number | null, label: string): number {
  if (r.error) throw new Error(`${label} could not run: ${r.error.message}`);
  if (r.status === null) throw new Error(`${label} was killed or did not exit`);
  if (count === null) throw new Error(`could not read ${label} from the command output`);
  if (r.status !== 0 && count === 0)
    throw new Error(`${label} exited ${r.status} but reported no findings`);
  return count;
}
const grab = (r: Run, re: RegExp) => {
  const m = re.exec(r.out);
  return m ? Number(m[1]) : null;
};

export function measureLocal(root: string, runner: Runner = run): Record<string, number> {
  const guard = runner(["scripts/check-boundaries.ts"]);
  const docs = runner(["scripts/check-docs.ts"]);
  const tsc = runner(["node_modules/typescript/bin/tsc", "--noEmit"]);
  return {
    "guard.violations": counted(guard, grab(guard, /(\d+) violations/), "guard"),
    "docs.missingLinks": counted(docs, grab(docs, /(\d+) missing/), "docs:check"),
    "types.errors": counted(tsc, (tsc.out.match(/error TS\d+/g) ?? []).length, "tsc"),
    "lint.suppressions": countSuppressions(root),
  };
}

const VALUE_FLAGS = ["--out", "--coverage", "--bundle", "--lighthouse", "--base"];
/** Every flag takes a value; a missing value, one starting with `--` or an unknown flag throws. */
export function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i] ?? "";
    const value = args[i + 1];
    if (!VALUE_FLAGS.includes(name)) throw new Error(`unknown argument ${name}`);
    if (value === undefined || value.startsWith("--")) throw new Error(`${name} needs a value`);
    flags[name] = value;
  }
  return flags;
}

/** Ratchets that got looser than at the base revision; a file new at the base is not compared. */
export function loosening(name: string, base: Json, current: Json): string[] {
  const out: string[] = [];
  const walk = (b: unknown, c: unknown, at: string, key: string, better: Better) => {
    if (typeof b === "number") {
      const dir = name === "lighthouse" ? lighthouseBetter(key) : better;
      const w = typeof c === "number" ? (dir === "lower" ? c > b : c < b) : true;
      if (w) out.push(`${name}.${at}: ${String(c)} is looser than ${b} at the base revision`);
    } else if (isObject(b))
      for (const [k, v] of Object.entries(b))
        walk(v, isObject(c) ? c[k] : undefined, `${at}.${k}`, k, better);
  };
  const keys = LOCAL.filter(([, , f]) => f === name).map(([, , , k]) => k);
  if (name === "coverage")
    for (const k of Object.keys(base)) walk(base[k], current[k], k, k, "higher");
  else if (name === "bundle" || name === "lighthouse")
    for (const [k, v] of Object.entries(isObject(base.baseline) ? base.baseline : {}))
      walk(
        v,
        isObject(current.baseline) ? current.baseline[k] : undefined,
        `baseline.${k}`,
        k,
        "lower",
      );
  else for (const k of keys) walk(base[k], current[k], k, k, "lower");
  return out;
}

if (import.meta.main) {
  try {
    const flags = parseFlags(process.argv.slice(2));
    const root = process.cwd();
    const read = (name: string): Json | undefined => {
      const file = flags[name];
      return file ? (JSON.parse(readFileSync(file, "utf8")) as Json) : undefined;
    };
    const input: Inputs = {
      ratchets: loadRatchets(path.join(root, "quality/ratchets")),
      local: measureLocal(root),
    };
    for (const key of ["coverage", "bundle", "lighthouse"] as const) {
      const value = read(`--${key}`);
      if (value) input[key] = value;
    }
    const commit =
      process.env.GITHUB_SHA ??
      spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    const card = buildScorecard(input, { commit: commit || null, now: new Date() });
    const schema = JSON.parse(readFileSync("quality/scorecard.schema.json", "utf8")) as Json;
    const problems = validate(schema, card);
    if (problems.length)
      throw new Error(`scorecard does not match its schema: ${problems.join("; ")}`);
    writeFileSync(flags["--out"] ?? "scorecard.json", `${JSON.stringify(card, null, 2)}\n`);
    for (const [id, axis] of Object.entries(card.axes as Record<string, { status: string }>))
      console.log(`${id} ${axis.status}`);
    const s = card.summary;
    console.log(
      `Scorecard: ${s.measured} measured, ${s.gaps} named gaps, ${s.warnings} warnings, ${s.regressions} regressions.`,
    );
    if (s.regressions) process.exitCode = 1;
    if (flags["--base"]) {
      const rev = resolveBase(flags["--base"]);
      for (const [name, current] of Object.entries(input.ratchets)) {
        const base = readBaseRatchet(rev, `quality/ratchets/${name}.json`);
        if (isObject(base))
          for (const line of loosening(name, base, current)) {
            console.error(`Scorecard: ratchet loosened: ${line}`);
            process.exitCode = 1;
          }
      }
    }
  } catch (error) {
    console.error(`Scorecard: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}
