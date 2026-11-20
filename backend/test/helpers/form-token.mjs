// A sign-up or comment form token, as the frontend's page would have issued it
// (ASVS 2.4.2; backend/src/common/form-timing.guard.ts). Backdated a few
// seconds, as if a person had filled the form in. Must use the server's
// SESSION_SECRET.

import { createHmac } from "node:crypto";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";

export function formToken(purpose, ageMs = 5000, secret = SESSION_SECRET) {
  const data = Buffer.from(JSON.stringify({ p: purpose, t: Date.now() - ageMs })).toString("base64url");
  return `${data}.${createHmac("sha256", secret).update(`form-timing:${data}`).digest("base64url")}`;
}

/** The token header a POST to the sign-up or comment route needs; nothing for any other request. */
export function formTimingHeaders(path, method = "GET") {
  if (String(method).toUpperCase() !== "POST") return {};
  if (/\/auth\/signup$/.test(path)) return { "x-form-token": formToken("signup") };
  if (/\/tor\/[^/]+\/feedback$/.test(path)) return { "x-form-token": formToken("feedback") };
  return {};
}
