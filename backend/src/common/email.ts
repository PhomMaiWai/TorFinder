import { env } from "../config/env";

export type Email = { to: string; subject: string; text: string; html: string };

/** Each send gets this long before it is given up on. */
const TIMEOUT_MS = 8_000;

export const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Whether this deployment can send mail at all: a Resend key is set, or (for
 * testing) a local mail catcher takes every message instead.
 */
export const canSendEmail = () => Boolean(env.notify.mailCatcherUrl || env.notify.resendApiKey);

/** "TOR Finder <noreply@x>" → { Name, Email }; a bare address has no name. */
function parseFrom(from: string): { Name?: string; Email: string } {
  // Sliced rather than matched: no regex to backtrack on (test/regex-audit).
  const open = from.lastIndexOf("<");
  const close = from.lastIndexOf(">");
  if (open === -1 || close < open) return { Email: from.trim() };
  return { Name: from.slice(0, open).trim() || undefined, Email: from.slice(open + 1, close).trim() };
}

async function check(res: Response): Promise<void> {
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
}

/**
 * One message. Normally through Resend's HTTP API — no SMTP client to install.
 * With MAIL_CATCHER_URL set it goes to Mailpit's send API instead, which keeps
 * every message for viewing at its web UI and delivers nothing: any address
 * can be tested without a verified sending domain. Throws on failure.
 */
export async function sendEmail({ to, subject, text, html }: Email): Promise<void> {
  if (env.notify.mailCatcherUrl) {
    const res = await fetch(`${env.notify.mailCatcherUrl.replace(/\/$/, "")}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ From: parseFrom(env.notify.emailFrom), To: [{ Email: to }], Subject: subject, Text: text, HTML: html }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return check(res);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.notify.resendApiKey}` },
    body: JSON.stringify({ from: env.notify.emailFrom, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return check(res);
}
