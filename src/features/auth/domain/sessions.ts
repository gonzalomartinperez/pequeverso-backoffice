/**
 * Privacy reductions for the session and audit views (pure). A session list never shows a full
 * client address or a raw user agent: the address is cut to its network prefix (IPv4 /24, IPv6
 * /48) and the agent to a browser and system family. ADR 0017.
 */

const OCTET = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function ipv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4 || !parts.every((part) => OCTET.test(part))) return null;
  return parts.map(Number);
}

/** Expands an IPv6 address to eight 16-bit groups, or null when it is not one. */
function ipv6(value: string): number[] | null {
  if (!/^[0-9a-f:.]+$/i.test(value) || value.split("::").length > 2) return null;
  let text = value;
  const tail = /:(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (tail) {
    const v4 = ipv4(tail[1] ?? "");
    if (!v4) return null;
    const [a = 0, b = 0, c = 0, d = 0] = v4;
    text = `${text.slice(0, tail.index)}:${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head = "", rest] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = rest ? rest.split(":") : [];
  const missing = 8 - left.length - right.length;
  if (rest === undefined ? missing !== 0 : missing < 1) return null;
  const groups = [...left, ...Array<string>(rest === undefined ? 0 : missing).fill("0"), ...right];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
}

/**
 * Network prefix of a client address for display: `203.0.113.0/24` or `2001:db8:85a3::/48`.
 * IPv4-mapped IPv6 addresses are shown as IPv4. Anything unparseable is withheld (null).
 */
export function ipPrefix(address: string | null | undefined): string | null {
  if (typeof address !== "string") return null;
  const value = address.trim();
  const v4 = ipv4(value);
  if (v4) return `${v4.slice(0, 3).join(".")}.0/24`;
  const v6 = ipv6(value);
  if (!v6) return null;
  const v4Prefix = (c: number, d: number) => `${c >> 8}.${c & 0xff}.${d >> 8}.0/24`;
  // IPv4-mapped (::ffff:a.b.c.d) and 6to4 (2002:aabb:ccdd::/48) carry a client IPv4 address in
  // the groups a /48 would show, so both are reduced to that address's /24.
  if (v6.slice(0, 5).every((group) => group === 0) && v6[5] === 0xffff)
    return v4Prefix(v6[6] ?? 0, v6[7] ?? 0);
  if (v6[0] === 0x2002) return v4Prefix(v6[1] ?? 0, v6[2] ?? 0);
  return `${v6
    .slice(0, 3)
    .map((group) => group.toString(16))
    .join(":")}::/48`;
}

export type AgentSummary = { browser: string | null; system: string | null };

const BROWSERS: readonly [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\b(?:OPR|Opera)\//, "Opera"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\//, "Chrome"],
  [/\bVersion\/[\d.]+.*\bSafari\//, "Safari"],
];
const SYSTEMS: readonly [RegExp, string][] = [
  [/\b(?:iPhone|iPad|iPod)\b/, "iOS"],
  [/\bAndroid\b/, "Android"],
  [/\bWindows\b/, "Windows"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bLinux\b/, "Linux"],
];

/** Browser and system families only; versions, devices and the raw string are never kept. */
export function agentSummary(userAgent: string | null | undefined): AgentSummary {
  const agent = typeof userAgent === "string" ? userAgent.slice(0, 512) : "";
  const match = (table: readonly [RegExp, string][]) =>
    table.find(([pattern]) => pattern.test(agent))?.[1] ?? null;
  return { browser: match(BROWSERS), system: match(SYSTEMS) };
}

/** Position in the audit trail, newest first: entries strictly before (`at`, `id`). */
export type AuditCursor = { at: Date; id: string };

const AUDIT_ID = /^[0-9A-Za-z-]{1,64}$/;

/** Opaque URL-safe form `<epoch ms>.<id>`; ids are the audit table's UUID text. */
export function encodeAuditCursor(cursor: AuditCursor): string {
  const ms = cursor.at.getTime();
  // Only positions decodeAuditCursor accepts, so a page can always be followed.
  if (!Number.isSafeInteger(ms) || ms < 0 || !AUDIT_ID.test(cursor.id))
    throw new RangeError("audit cursor position is not encodable");
  return `${ms}.${cursor.id}`;
}

/** Null for anything that is not a cursor this module produced (fail closed, no partial parse). */
export function decodeAuditCursor(value: string | null | undefined): AuditCursor | null {
  if (typeof value !== "string") return null;
  const match = /^(0|[1-9]\d{0,14})\.(.+)$/.exec(value);
  if (!match || !AUDIT_ID.test(match[2] ?? "")) return null;
  const at = new Date(Number(match[1]));
  return Number.isNaN(at.getTime()) ? null : { at, id: match[2] ?? "" };
}
