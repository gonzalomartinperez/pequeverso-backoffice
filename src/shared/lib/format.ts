import { es } from "#shared/i18n/es.ts";

/** Spanish display helpers. Every function renders `null` as the same honest placeholder. */
export const UNAVAILABLE = es.common.unavailable;

const integer = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const dayFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function count(value: number | null): string {
  return value == null ? UNAVAILABLE : integer.format(value);
}

export function tokens(value: number | null): string {
  return value == null ? UNAVAILABLE : compact.format(value);
}

/** USD with enough decimals for sub-cent model costs (4 below one dollar, 2 above). */
export function usd(value: string | null): string {
  if (value == null) return UNAVAILABLE;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return UNAVAILABLE;
  if (amount > 0 && amount < 0.0001) return "< US$ 0,0001";
  if (amount < 0 && amount > -0.0001) return "> −US$ 0,0001";
  const digits = Math.abs(amount) < 1 ? 4 : 2;
  return `US$ ${new Intl.NumberFormat("es", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)}`;
}

export function when(value: Date | null): string {
  return value == null ? UNAVAILABLE : `${dateTime.format(value)} UTC`;
}

export function day(value: string): string {
  return dayFormat.format(new Date(`${value}T00:00:00Z`));
}

export function ms(value: number | null): string {
  if (value == null) return UNAVAILABLE;
  return value >= 1000
    ? `${new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(value / 1000)} s`
    : `${integer.format(value)} ms`;
}

/** Percentage with one decimal; a small non-zero share never collapses to "0 %". */
export function pct(value: number | null): string {
  if (value == null) return UNAVAILABLE;
  if (value > 0 && value < 0.1) return "< 0,1 %";
  return `${new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(value)} %`;
}

/** Relative age ("hace 3 h") for freshness, from a fixed reading time. */
export function age(value: Date | null, now: Date): string {
  if (value == null) return UNAVAILABLE;
  const minutes = Math.round((now.getTime() - value.getTime()) / 60_000);
  if (minutes < 1) return es.format.ageUnderMinute;
  if (minutes < 60) return es.format.ageMinutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 48) return es.format.ageHours(hours);
  return es.format.ageDays(Math.round(hours / 24));
}

/** API reason codes (snake_case, from the ops contract) to their dictionary messages. */
const REASONS: Readonly<Record<string, string>> = {
  assistant_disabled: es.format.reasons.assistantDisabled,
  catalog_unavailable: es.format.reasons.catalogUnavailable,
  budget_exhausted: es.format.reasons.budgetExhausted,
  provider_unavailable: es.format.reasons.providerUnavailable,
  generation_failed: es.format.reasons.generationFailed,
  timeout: es.format.reasons.timeout,
  busy: es.format.reasons.busy,
};

export function reason(code: string | null): string {
  if (code == null) return es.format.noReason;
  return Object.hasOwn(REASONS, code) ? (REASONS[code] ?? code) : code;
}

export function windowLabel(hours: number): string {
  if (hours === 24) return es.format.last24Hours;
  if (hours % 24 === 0) return es.format.lastDays(hours / 24);
  return es.format.lastHours(hours);
}
