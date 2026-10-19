import { type Selection, validSelection } from "./report.ts";
export function reportSelection(
  params: Record<string, string | string[] | undefined>,
): Selection | null {
  if (Object.values(params).some((value) => Array.isArray(value) || value === undefined))
    return null;
  if (params.offset !== undefined && !/^[012]$/.test(params.offset as string)) return null;
  return validSelection({
    ...params,
    ...(params.offset !== undefined ? { offset: Number(params.offset) } : {}),
  });
}
