import { createTransport, type Transporter } from "nodemailer";

import { env } from "../config/env";

export type Email = { to: string; subject: string; text: string; html: string };

/** Each send gets this long before it is given up on. */
const TIMEOUT_MS = 8_000;

export const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Whether this deployment can send mail at all: an SMTP server or a Resend
 * key is set, or (for testing) a local mail catcher takes every message instead.
 */
export const canSendEmail = () => Boolean(env.notify.mailCatcherUrl || env.notify.smtp.host || env.notify.resendApiKey);

/** "TOR Finder <noreply@x>" → { Name, Email }; a bare address has no name. */
function parseFrom(from: string): { Name?: string; Email: string } {
  // Sliced rather than matched: no regex to backtrack on (test/regex-audit).
  const open = from.lastIndexOf("<");
  const close = from.lastIndexOf(">");
  if (open === -1 || close < open) return { Email: from.trim() };
  return { Name: from.slice(0, open).trim() || undefined, Email: from.slice(open + 1, close).trim() };
}

/** One connection setup for the process; nodemailer reconnects as needed. */
let smtpTransport: Transporter | null = null;

function smtp(): Transporter {
  const { host, port, secure, user, pass } = env.notify.smtp;
  smtpTransport ??= createTransport({
    host,
    port,
    secure,
    // No account means an open relay inside the network (Mailpit's SMTP port, say).
    auth: user ? { user, pass } : undefined,
    // ASVS 12.3.1: an SMTP server proves who it is like any other TLS peer.
    requireTLS: !secure && Boolean(user),
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
  return smtpTransport;
}

/**
 * Who the mail says it is from over SMTP. Gmail sends only as the account that
 * signed in and rewrites anything else, so the address is the account's and
 * NOTIFY_EMAIL_FROM lends only its display name.
 */
function smtpFrom(): string {
  const { Name, Email } = parseFrom(env.notify.emailFrom);
  const address = env.notify.smtp.user || Email;
  return Name ? `"${Name.replace(/"/g, "")}" <${address}>` : address;
}

async function check(res: Response): Promise<void> {
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
}

/**
 * One message, by the first route this deployment has:
 *  1. MAIL_CATCHER_URL — Mailpit's send API, which keeps every message for
 *     viewing at its web UI and delivers nothing (testing);
 *  2. SMTP_HOST — any SMTP server, e.g. Gmail with an app password, which
 *     delivers to any address without a verified sending domain;
 *  3. Resend's HTTP API.
 * Throws on failure.
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

  if (env.notify.smtp.host) {
    await smtp().sendMail({ from: smtpFrom(), to, subject, text, html });
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.notify.resendApiKey}` },
    body: JSON.stringify({ from: env.notify.emailFrom, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return check(res);
}
