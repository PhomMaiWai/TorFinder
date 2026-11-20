import { createHmac } from "node:crypto";

import { readSessionSecret } from "@/lib/auth";
import { FORM_TOKEN_FIELD } from "@/lib/form-timing-field";

/**
 * ASVS 2.4.2: a token saying when a sign-up or comment form was served. The
 * page puts it in the form; the server action sends it to the backend in
 * X-Form-Token, and the backend's FormTimingGuard refuses a submission that
 * comes back sooner than a person could fill it in. Signed with the session
 * secret both sides share (with its own prefix, so it is never a valid
 * session signature). Mirrors backend/src/common/form-timing.guard.ts.
 */
export type FormPurpose = "signup" | "feedback";

export { FORM_TOKEN_FIELD };

/** A fresh token for a form being served now. Server-side only: it needs the secret. */
export function issueFormToken(purpose: FormPurpose): string {
  const data = Buffer.from(JSON.stringify({ p: purpose, t: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", readSessionSecret()).update(`form-timing:${data}`).digest("base64url");
  return `${data}.${signature}`;
}

/** The header carrying a submitted form's token on to the backend. */
export function formTokenHeader(formData: FormData): Record<string, string> {
  const token = formData.get(FORM_TOKEN_FIELD);
  return typeof token === "string" && token ? { "X-Form-Token": token } : {};
}
