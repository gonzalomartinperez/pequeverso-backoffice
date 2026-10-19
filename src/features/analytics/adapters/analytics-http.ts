import type { AnalyticsReading, AnalyticsSource } from "../application/ports.ts";
import { parseAnalyticsReport } from "./validate.ts";

const MAX_BYTES = 256 * 1024;
/** No retries, redirects, cookies, cache or forwarding of browser headers. */
export function analyticsHttp(
  settings: { url: string; token: string } | null,
  enabled: boolean,
  fetcher: typeof fetch = fetch,
  timeoutMs = 4000,
): AnalyticsSource {
  return {
    async read(selection): Promise<AnalyticsReading> {
      if (!enabled) return { status: "disabled" };
      if (!settings) return { status: "unavailable", reason: "not_configured" };
      const controller = new AbortController();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let rejectDeadline: (reason: Error) => void = () => {};
      const deadline = new Promise<never>((_, reject) => {
        rejectDeadline = reject;
      });
      const timer = setTimeout(() => {
        controller.abort();
        rejectDeadline(new Error("Analytics read deadline"));
      }, timeoutMs);
      try {
        const query = new URLSearchParams(
          Object.entries(selection).map(([key, value]) => [key, String(value)]),
        );
        const response = await Promise.race([
          fetcher(`${settings.url}/internal/v1/ops/product-analytics?${query}`, {
            headers: { Authorization: `Bearer ${settings.token}`, Accept: "application/json" },
            cache: "no-store",
            redirect: "error",
            signal: controller.signal,
          }),
          deadline,
        ]);
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          return response.status === 404
            ? { status: "disabled" }
            : { status: "unavailable", reason: "rejected" };
        }
        if (
          !/^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? "") ||
          Number(response.headers.get("content-length") ?? "0") > MAX_BYTES ||
          !response.body
        )
          throw new Error("Invalid aggregate response");
        reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const { done, value } = await Promise.race([reader.read(), deadline]);
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) throw new Error("Aggregate response too large");
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        const payload: unknown = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        );
        return { status: "available", report: parseAnalyticsReport(payload, selection) };
      } catch {
        return { status: "unavailable", reason: "invalid_or_unreachable" };
      } finally {
        clearTimeout(timer);
        controller.abort();
        if (reader) {
          void reader.cancel().catch(() => {});
          try {
            reader.releaseLock();
          } catch {
            /* The aborted read already failed closed. */
          }
        }
      }
    },
  };
}
