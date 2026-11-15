// Contract drift watch: fetches the pinned producer files from the API repository's `develop`
// branch (read-only, token-free raw GitHub URLs) and reports two things per contract: whether
// the bytes still match the committed pin (drift) and whether this repository's own validators
// still accept the API's example (breaking). It never rewrites a pin; a human re-pins in a PR.
//
//   node scripts/contract-drift.ts [--summary path]   exit 1 on drift or breakage, 2 on fetch errors
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseAnalyticsReport } from "../src/features/analytics/adapters/validate.ts";
import { parseOpsTelemetry } from "../src/features/operations/adapters/telemetry-validate.ts";
import { parseOpsSummary } from "../src/features/operations/adapters/validate.ts";

type Pin = {
  api_repository: string;
  api_branch?: string;
  files: Record<string, { sha256: string }>;
};
export type Fetcher = (url: string) => Promise<Uint8Array>;
export type Finding = {
  contract: string;
  file: string;
  problem: "drift" | "breaking";
  detail: string;
};

/** API example path -> the validator of this repository that must accept it. */
export const EXAMPLES: Record<string, Record<string, (value: unknown) => unknown>> = {
  ops: { "contracts/examples/ops.summary.json": parseOpsSummary },
  telemetry: { "contracts/examples/ops.telemetry.json": parseOpsTelemetry },
  analytics: {
    "contracts/examples/product-analytics.json": (v) => {
      const report = (v as { report: { selection: Parameters<typeof parseAnalyticsReport>[1] } })
        .report;
      return parseAnalyticsReport(report, report.selection);
    },
  },
};

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export async function watch(
  contract: string,
  pin: Pin,
  fetcher: Fetcher,
  branch = "develop",
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const base = `https://raw.githubusercontent.com/${pin.api_repository}/${branch}/`;
  for (const [file, { sha256: pinned }] of Object.entries(pin.files)) {
    const bytes = await fetcher(base + file);
    if (sha256(bytes) !== pinned)
      findings.push({
        contract,
        file,
        problem: "drift",
        detail: `develop bytes differ from the pin ${pinned.slice(0, 12)}`,
      });
    const validate = EXAMPLES[contract]?.[file];
    if (!validate) continue;
    try {
      validate(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (error) {
      findings.push({
        contract,
        file,
        problem: "breaking",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return findings;
}

export const render = (findings: Finding[]): string =>
  findings.length === 0
    ? "Contract drift watch: the API develop contracts match the pins and validate."
    : [
        "Contract drift watch: the API develop branch no longer matches the committed pins.",
        ...findings.map((f) => `- ${f.problem.toUpperCase()} ${f.contract} ${f.file}: ${f.detail}`),
        "Re-pin deliberately in a normal task PR; the pins are never updated automatically.",
      ].join("\n");

export const MAX_BYTES = 1024 * 1024;

/** Redirects are errors and a body over 1 MiB is refused while streaming. */
export const fetchRaw: Fetcher = async (url) => {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`GET ${url} answered ${response.status}`);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.byteLength;
    if (size > MAX_BYTES) throw new Error(`GET ${url} exceeds ${MAX_BYTES} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

if (import.meta.main) {
  try {
    const findings: Finding[] = [];
    for (const contract of Object.keys(EXAMPLES)) {
      const pin = JSON.parse(readFileSync(`contracts/${contract}/source.json`, "utf8")) as Pin;
      findings.push(...(await watch(contract, pin, fetchRaw, pin.api_branch ?? "develop")));
    }
    const text = render(findings);
    console.log(text);
    const at = process.argv.indexOf("--summary");
    if (at > 0 && process.argv[at + 1]) writeFileSync(process.argv[at + 1] as string, `${text}\n`);
    if (findings.length) process.exitCode = 1;
  } catch (error) {
    console.error(
      `Contract drift watch: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 2;
  }
}
