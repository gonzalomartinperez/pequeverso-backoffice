import type { Metadata } from "next";
import { AnalyticsReport } from "#features/analytics/presentation/report.tsx";
import { readAnalytics } from "#server/container.ts";
import { es } from "#shared/i18n/es.ts";
export const metadata: Metadata = {
  title: es.analytics.title,
  robots: { index: false, follow: false },
};
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await readAnalytics(await searchParams);
  return <AnalyticsReport {...result} />;
}
