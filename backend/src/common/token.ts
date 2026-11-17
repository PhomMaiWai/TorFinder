import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../config/env";
import { Role } from "./roles";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: Role;
  /** When this token was issued, in epoch seconds — SessionRevocationService's unit of revocation. */
  iat: number;
  /**
   * Last activity, in epoch seconds. Starts at `iat`; the frontend re-signs the
   * token with a fresh `act` while the user keeps using the site.
   */
  act?: number;
  exp: number;
};

/** Absolute lifetime (ASVS 7.3.2): re-authenticate after 7 days whatever the activity. */
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function sign(data: string) {
  return createHmac("sha256", env.sessionSecret).update(data).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "iat" | "exp">): string {
  const iat = Math.floor(Date.now() / 1000);
  const body: SessionPayload = { ...payload, iat, act: iat, exp: iat + SESSION_MAX_AGE };
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  const [data, signature] = token?.split(".") ?? [];
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!(payload.exp > now)) return null;
    // ASVS 7.3.1: an unused session ends after the idle window, even within
    // its 7-day absolute lifetime (7.3.2). Every token we issue carries `iat`.
    const lastActive = payload.act ?? payload.iat;
    if (lastActive !== undefined && now - lastActive > env.sessionIdleMinutes * 60) return null;
    return payload;
  } catch {
    return null;
  }
}
