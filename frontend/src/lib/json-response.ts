import { NextResponse } from "next/server";

/**
 * `NextResponse.json` with the charset stated and caching off: `Response.json` sends a bare
 * `application/json`, and ASVS 4.1.1 asks every body's Content-Type to name
 * its encoding. Returns a NextResponse, so callers can still set cookies on it.
 */
export function jsonResponse(body: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("Content-Type", "application/json; charset=utf-8");
  // ASVS 14.3.2: these answers are per-account; never kept by a browser or proxy cache.
  if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "no-store");
  return response;
}
