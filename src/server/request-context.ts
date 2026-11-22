import "server-only";
import { headers } from "next/headers";
import { isRequestId, REQUEST_ID_HEADER } from "./request-id.ts";

/** The proxy's sanitized request id for this request; null outside a request (scripts, tests). */
export async function currentRequestId(): Promise<string | null> {
  try {
    const value = (await headers()).get(REQUEST_ID_HEADER);
    return isRequestId(value) ? value : null;
  } catch {
    return null;
  }
}
