import type { Role } from "@/lib/roles";

export type { Role } from "@/lib/roles";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: Role;
  exp: number;
};

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * `__Host-` makes the browser accept the cookie only when it is Secure, sent
 * from this exact host and scoped to `/` — so neither a sibling subdomain nor a
 * plain-HTTP response can plant or overwrite a session (ASVS 3.3.1). Dev keeps
 * the plain name, because some browsers refuse Secure cookies on
 * http://localhost.
 */
export const SESSION_COOKIE = IS_PRODUCTION ? "__Host-torr_session" : "torr_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** The one set of attributes every response that sets or clears the session uses. */
export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** The placeholder every .env.example ships with — public, so never a real key. */
const DEV_SESSION_SECRET = "dev-only-insecure-secret-change-me";
const MIN_SESSION_SECRET_LENGTH = 32;

/** Same rule as the backend's env.ts: production refuses a missing, published or short secret (ASVS 9.1.3). */
function readSessionSecret() {
  const value = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV !== "production") return value || DEV_SESSION_SECRET;
  if (!value || value === DEV_SESSION_SECRET || value.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be a private random value of at least ${MIN_SESSION_SECRET_LENGTH} characters in production — generate one with: openssl rand -base64 32`,
    );
  }
  return value;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(readSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(data: string) {
  const key = await hmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(signature));
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = await sign(data);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(data))) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
