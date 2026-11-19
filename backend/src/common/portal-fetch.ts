import { BadGatewayException, NotFoundException } from "@nestjs/common";

import { logSecurityEvent } from "./security-log";

/**
 * The only hosts the backend fetches an announcement's files from (ASVS 1.3.6,
 * 13.2.4, 15.3.2; threat E3). Document URLs come from the portals' own data,
 * so a record carrying any other address — a poisoned import, a bad manual
 * edit — must not make the server fetch it. Taken from every document link in
 * the data: e-GP's and MEA's file servers serve their own files, without
 * redirects to other hosts.
 */
export const PORTAL_FILE_HOSTS: readonly string[] = ["egp2.bangkok.go.th", "procurement.mea.or.th"];

/** Enough for a portal that moves a file once or twice; a loop or a long chain is refused. */
const MAX_REDIRECTS = 3;

/** HTTPS, an allowlisted host on the default port, and no credentials in the URL. */
export function isAllowedPortalUrl(url: string | URL): boolean {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : url;
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    parsed.port === "" &&
    parsed.username === "" &&
    parsed.password === "" &&
    PORTAL_FILE_HOSTS.includes(parsed.hostname.toLowerCase())
  );
}

/** The allowlist as a Mongo pattern prefix, for queries that must select only what isAllowedPortalUrl accepts. */
export const PORTAL_FILE_URL_PREFIX = `^https://(?:${PORTAL_FILE_HOSTS.map((host) => host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`;

/**
 * fetch() for a portal file. Redirects are followed by hand, at most
 * MAX_REDIRECTS, and only to allowlisted hosts, so a portal (or a spoofed
 * answer) can't bounce the server to an internal address. A refused URL is
 * logged as a security event: in normal operation it never happens.
 */
export async function fetchPortalFile(url: string, init: RequestInit = {}): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedPortalUrl(current)) {
      logSecurityEvent("access.denied", { outcome: "failure", reason: "portal_host_not_allowed", path: safeForLog(current) });
      throw new NotFoundException("เอกสารนี้ไม่ได้มาจากเว็บต้นทางที่รองรับ");
    }
    const res = await fetch(current, { ...init, redirect: "manual" }).catch(() => {
      throw new BadGatewayException("เชื่อมต่อเว็บต้นทางไม่สำเร็จ");
    });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) return res;
    await res.body?.cancel();
    current = new URL(location, current).toString();
  }
  throw new BadGatewayException("เว็บต้นทางส่งต่อลิงก์หลายครั้งเกินไป");
}

/** Host and path only: a query string could carry something that doesn't belong in a log. */
function safeForLog(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "(unparseable URL)";
  }
}
