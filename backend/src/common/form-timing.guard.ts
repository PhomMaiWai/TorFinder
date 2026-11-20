import { BadRequestException, CanActivate, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../config/env";
import { logSecurityEvent } from "./security-log";
import { verifyingSecrets } from "./session-keys";

/** The forms that carry a timing token; the purpose is signed in, so one form's token can't be used on another. */
export type FormPurpose = "signup" | "feedback";

const FORM_PURPOSE = "formPurpose";

/** Marks a route as needing a human-timed form token (ASVS 2.4.2). Use with FormTimingGuard. */
export const FormTiming = (purpose: FormPurpose) => SetMetadata(FORM_PURPOSE, purpose);

/** Where the frontend sends the token it put in the form. */
export const FORM_TOKEN_HEADER = "x-form-token";

/** A form left open longer than this has to be reloaded. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const TOO_FAST = "ส่งแบบฟอร์มเร็วเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง";
const STALE = "แบบฟอร์มนี้หมดอายุหรือไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง";

/**
 * The token's signature: HMAC-SHA256 under the session secret the frontend
 * shares, with a prefix so it can never pass as a session signature (or the
 * other way round). Mirrors frontend/src/lib/form-timing.ts.
 */
const sign = (data: string, secret: string) => createHmac("sha256", secret).update(`form-timing:${data}`).digest();

/** The time the form was served, if the token is genuine and for this purpose; null otherwise. */
export function formStartedAt(token: string | undefined, purpose: FormPurpose): number | null {
  const [data, signature] = token?.split(".") ?? [];
  if (!data || !signature) return null;
  const received = Buffer.from(signature, "base64url");
  // Any key still accepted: a form served just before a rotation stays valid.
  const genuine = verifyingSecrets().some((secret) => {
    const expected = sign(data, secret);
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
  if (!genuine) return null;
  try {
    const { p, t } = JSON.parse(Buffer.from(data, "base64url").toString()) as { p?: unknown; t?: unknown };
    return p === purpose && typeof t === "number" && Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/**
 * ASVS 2.4.2: a person needs a few seconds to fill in a sign-up or a comment;
 * a script posting straight to the API doesn't. The page that serves the form
 * puts in a signed token saying when (frontend/src/lib/form-timing.ts), and
 * this guard refuses the submission if it comes back sooner than
 * FORM_MIN_SECONDS (default 2), or carries no genuine token, or one older
 * than a day. The token can be sent again, so a form refused for a typo can
 * be fixed and resubmitted; how often is bounded by the routes' rate limits.
 */
@Injectable()
export class FormTimingGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const purpose = this.reflector.get<FormPurpose | undefined>(FORM_PURPOSE, context.getHandler());
    if (!purpose) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers[FORM_TOKEN_HEADER];
    const startedAt = formStartedAt(typeof header === "string" ? header : undefined, purpose);
    const age = startedAt === null ? null : Date.now() - startedAt;

    const reject = (reason: string, message: string): never => {
      logSecurityEvent("input.rejected", { outcome: "failure", ip: request.ip, reason, method: request.method, path: request.path });
      throw new BadRequestException(message);
    };
    if (age === null || age > MAX_AGE_MS || age < -60_000) reject("form_token_invalid", STALE);
    if (age! < env.formMinSeconds * 1000) reject("form_too_fast", TOO_FAST);
    return true;
  }
}
