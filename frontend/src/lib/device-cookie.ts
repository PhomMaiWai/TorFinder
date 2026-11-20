import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";

/**
 * Lets the backend tell a browser it has seen before from a new one, so a
 * sign-in from somewhere new can be emailed to the account's owner (ASVS
 * 6.3.5). The cookie holds 32 random bytes and nothing else: it identifies a
 * browser, not a person, signs nobody in and is never shown to the page
 * (HttpOnly). The backend keeps only its hash.
 *
 * Server-side only: the sign-in route handlers read it, send it on, and set
 * it on the answer when this browser didn't have one yet.
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** `__Host-` in production, like the session cookie: Secure, this host only, path `/`. */
export const DEVICE_COOKIE = IS_PRODUCTION ? "__Host-torr_device" : "torr_device";

/** 400 days, the longest a browser keeps a cookie; renewed at every sign-in. */
const DEVICE_MAX_AGE = 400 * 24 * 60 * 60;

const DEVICE_ID = /^[A-Za-z0-9_-]{43}$/;

export type ClientDevice = { id: string; headers: Record<string, string> };

/** This browser's device id (a new one if it has none), and the headers that carry it and its user agent to the backend. */
export async function clientDevice(): Promise<ClientDevice> {
  const existing = (await cookies()).get(DEVICE_COOKIE)?.value;
  const id = existing && DEVICE_ID.test(existing) ? existing : Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const userAgent = (await headers()).get("user-agent")?.slice(0, 512);
  return { id, headers: { "X-Device-Id": id, ...(userAgent && { "X-Client-User-Agent": userAgent }) } };
}

/** Keeps (or first gives) this browser its device id. Set on every answer to a sign-in step. */
export function rememberDevice<T extends NextResponse>(response: T, device: ClientDevice): T {
  response.cookies.set(DEVICE_COOKIE, device.id, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_MAX_AGE,
  });
  return response;
}
