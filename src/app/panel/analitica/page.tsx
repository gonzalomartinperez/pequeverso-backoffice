import type { Metadata } from "next";
import { AnalyticsReport } from "@/features/analytics/presentation/report";
import { readAnalytics } from "@/server/analytics";
export const metadata: Metadata = {
  title: "Actividad del sitio",
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
