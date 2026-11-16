import { NextResponse } from "next/server";

/**
 * `NextResponse.json` with the charset stated: `Response.json` sends a bare
 * `application/json`, and ASVS 4.1.1 asks every body's Content-Type to name
 * its encoding. Returns a NextResponse, so callers can still set cookies on it.
 */
export function jsonResponse(body: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("Content-Type", "application/json; charset=utf-8");
  return response;
}
