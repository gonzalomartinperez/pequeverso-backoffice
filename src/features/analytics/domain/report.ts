/** Product-owned, fixture-only profile; no visitor identity or production collection. */
export const profileSource = "88d6d0add414261e5ccf5bd3e2b21285e1a33179";
export const profile = {
  "/": ["hero", "leer", "bebe", "preguntas"],
  "/grafismo-fonetico/": ["hero", "incluye", "metodo", "preguntas"],
} as const;
export type Route = keyof typeof profile;
export type Section = (typeof profile)[Route][number];
export type Selection = {
  period: "day" | "week" | "month";
  offset: 0 | 1 | 2;
  route: Route | "all";
  section_id: Section | "all";
  viewport_bucket: "all" | "mobile" | "tablet" | "desktop";
  locale: "es";
};
export const defaultSelection: Selection = {
  period: "month",
  offset: 0,
  route: "all",
  section_id: "all",
  viewport_bucket: "all",
  locale: "es",
};
export type Counts = { page_views: number; section_views: number; public_clicks: number };
export type Report = {
  schema_version: 1;
  project: "pequeverso";
  layout_revision: "pequeverso-v1";
  profile_source_revision: typeof profileSource;
  synthetic: true;
  coverage: "received_events_only";
  timezone: "UTC";
  country_collection: "disabled";
  retention_days: 93;
  min_bucket: 3;
  generated_at: string;
  selection: Selection;
  start: string;
  end: string;
  partial: boolean;
  first_observed_at: string | null;
  last_observed_at: string | null;
  totals: Counts;
  daily: (Counts & { day: string })[];
  countries: { code: "unknown" | "withheld"; count: number }[];
  grid: {
    available: boolean;
    visible_clicks: number;
    withheld_clicks: number;
    unselected_clicks: number;
    cells: { x: number; y: number; count: number }[];
  };
};

const keys = ["period", "offset", "route", "section_id", "viewport_bucket", "locale"];
export function validSelection(value: Record<string, unknown>): Selection | null {
  if (Object.keys(value).some((key) => !keys.includes(key))) return null;
  const selection = { ...defaultSelection, ...value };
  if (
    typeof selection.period !== "string" ||
    typeof selection.viewport_bucket !== "string" ||
    typeof selection.route !== "string" ||
    typeof selection.section_id !== "string" ||
    typeof selection.offset !== "number" ||
    !["day", "week", "month"].includes(selection.period) ||
    ![0, 1, 2].includes(selection.offset) ||
    selection.locale !== "es" ||
    !["all", "mobile", "tablet", "desktop"].includes(selection.viewport_bucket) ||
    (selection.route !== "all" && !Object.hasOwn(profile, selection.route))
  )
    return null;
  if (selection.route === "all")
    return selection.section_id === "all" ||
      Object.values(profile).some((sections) =>
        (sections as readonly string[]).includes(selection.section_id),
      )
      ? selection
      : null;
  return selection.section_id === "all" ||
    (profile[selection.route as Route] as readonly string[]).includes(selection.section_id)
    ? selection
    : null;
}
