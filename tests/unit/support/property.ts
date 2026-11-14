import type { Parameters } from "fast-check";

export function propertyOptions(kind: "property" | "fuzz"): Parameters<unknown> {
  const variable = kind === "fuzz" ? "FC_FUZZ_RUNS" : "FC_NUM_RUNS";
  const numRuns = Number(process.env[variable] ?? 100);
  if (!Number.isSafeInteger(numRuns) || numRuns < 1)
    throw new Error(`${variable} must be a positive safe integer`);
  const rawSeed = process.env.FC_SEED;
  const seed = rawSeed === undefined ? undefined : Number(rawSeed);
  if (seed !== undefined && (!Number.isInteger(seed) || seed < -2147483648 || seed > 2147483647))
    throw new Error("FC_SEED must be a signed 32-bit integer");
  // Leave assert failures intact: fast-check reports seed, shrink path and counterexample.
  return { numRuns, ...(seed === undefined ? {} : { seed }) };
}
