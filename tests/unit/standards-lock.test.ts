import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const root = new URL("../../", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), "utf8");

type Lock = {
  standards: { repository: string; tag: string; commit: string };
  flow: string;
  files: { path: string; template: string }[];
};
const lock = JSON.parse(read("standards.lock")) as Lock;

const PIN = /gonzalomartinperez\/engineering-standards\/[^@\s]+@([0-9a-f]{40}) # (v\S+)/g;

function pins(source: string): { commit: string; tag: string }[] {
  return [...source.matchAll(PIN)].map((m) => ({ commit: m[1] ?? "", tag: m[2] ?? "" }));
}

function mismatches(workflows: Record<string, string>, expected: Lock["standards"]): string[] {
  return Object.entries(workflows).flatMap(([file, source]) =>
    pins(source)
      .filter((pin) => pin.commit !== expected.commit || pin.tag !== expected.tag)
      .map((pin) => `${file}: ${pin.commit.slice(0, 12)} ${pin.tag}`),
  );
}

const workflows = Object.fromEntries(
  readdirSync(new URL(".github/workflows/", root))
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => [file, read(`.github/workflows/${file}`)]),
);

describe("standards.lock", () => {
  it("records a released engineering-standards commit for the release flow", () => {
    assert.equal(lock.standards.repository, "gonzalomartinperez/engineering-standards");
    assert.match(lock.standards.tag, /^v1\.\d+\.\d+$/);
    assert.match(lock.standards.commit, /^[0-9a-f]{40}$/);
    assert.equal(lock.flow, "release");
    for (const required of [
      "SECURITY.md",
      "docs/master-plan/ecosystem.md",
      "docs/master-plan/rubrics.md",
    ])
      assert.ok(
        lock.files.some((f) => f.path === required),
        required,
      );
  });

  it("matches every engineering-standards pin in the workflows (commit and tag comment)", () => {
    assert.ok(
      Object.values(workflows).some((source) => pins(source).length > 0),
      "no pin found",
    );
    assert.deepEqual(mismatches(workflows, lock.standards), []);
  });

  it("flags a workflow pinned to another commit or tag", () => {
    const other = "0".repeat(40);
    const fixture = {
      "a.yml": `uses: gonzalomartinperez/engineering-standards/.github/workflows/drift.yml@${other} # ${lock.standards.tag}`,
      "b.yml": `uses: gonzalomartinperez/engineering-standards/actions/ci-gate@${lock.standards.commit} # v9.9.9`,
      "c.yml": `uses: gonzalomartinperez/engineering-standards/actions/ci-gate@${lock.standards.commit} # ${lock.standards.tag}`,
    };
    assert.equal(mismatches(fixture, lock.standards).length, 2);
  });
});
