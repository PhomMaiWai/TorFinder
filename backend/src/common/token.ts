import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../config/env";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: "admin" | "org";
  exp: number;
};

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sign(data: string) {
  return createHmac("sha256", env.sessionSecret).update(data).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const body: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
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
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
