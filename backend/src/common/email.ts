import { env } from "../config/env";

export type Email = { to: string; subject: string; text: string; html: string };

/** Each send gets this long before it is given up on. */
const TIMEOUT_MS = 8_000;

export const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Whether this deployment can send mail at all (a Resend key is set). */
export const canSendEmail = () => Boolean(env.notify.resendApiKey);

/** One message through Resend's HTTP API — no SMTP client to install. Throws on failure. */
export async function sendEmail({ to, subject, text, html }: Email): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.notify.resendApiKey}` },
    body: JSON.stringify({ from: env.notify.emailFrom, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
}
