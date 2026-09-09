import { jwtVerify, SignJWT } from "jose";

import { env } from "./env";
import type { AccountStatus } from "@/types/user";

export const SESSION_COOKIE = "torfinder_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  email: string;
  status: AccountStatus;
};

const secretKey = new TextEncoder().encode(env.JWT_SECRET);

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.status !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      status: payload.status as AccountStatus,
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;
