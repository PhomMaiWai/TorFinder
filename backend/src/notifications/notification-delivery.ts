import { canSendEmail, sendEmail as send } from "../common/email";
import { emailSubject, renderEmail } from "../common/email-layout";
import { env } from "../config/env";
import { NotificationChannels } from "../database/database.service";
import { canLinkLine } from "./line-link";

export type Channel = "email" | "slack" | "line";

/** A notification's words in one language. */
export type NotificationText = { title: string; message: string };

export type OutgoingNotification = {
  /** Thai: the in-app record and the Slack/LINE text. */
  title: string;
  message: string;
  /** The English version, added under the Thai in the email. */
  en: NotificationText;
  /** A page on the site to open, when the notification is about one. */
  link?: string;
};

export type DeliveryResult = { channel: Channel; ok: boolean; error?: string };

/** Each outside service gets this long before the attempt is given up on. */
const TIMEOUT_MS = 8_000;

/** Slack only ever issues incoming webhooks on this host. */
export const SLACK_WEBHOOK = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;

function plainText({ title, message, link }: OutgoingNotification): string {
  return [title, message, link].filter(Boolean).join("\n\n");
}

async function post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
}

function sendEmail(to: string, notification: OutgoingNotification): Promise<void> {
  const { title, message, en, link } = notification;
  const { html, text } = renderEmail({
    th: { heading: title, paragraphs: [message], buttonLabel: "เปิดดูใน TOR Finder" },
    en: { heading: en.title, paragraphs: [en.message], buttonLabel: "Open in TOR Finder" },
    buttonUrl: link,
  });
  return send({ to, subject: emailSubject(title, en.title), text, html });
}

function sendSlack(webhookUrl: string, notification: OutgoingNotification): Promise<void> {
  const { title, message, link } = notification;
  return post(webhookUrl, {
    text: plainText(notification),
    blocks: [
      { type: "header", text: { type: "plain_text", text: title.slice(0, 150) } },
      { type: "section", text: { type: "mrkdwn", text: link ? `${message}\n<${link}|เปิดดูใน TOR Finder>` : message } },
    ],
  });
}

function sendLine(to: string, notification: OutgoingNotification): Promise<void> {
  return post(
    "https://api.line.me/v2/bot/message/push",
    { to, messages: [{ type: "text", text: plainText(notification).slice(0, 5_000) }] },
    { Authorization: `Bearer ${env.notify.lineChannelAccessToken}` },
  );
}

/** Which channels the account turned on that this deployment can actually send through. */
export function activeChannels(channels: NotificationChannels | undefined): Channel[] {
  if (!channels) return [];
  return [
    channels.email && canSendEmail() ? ("email" as const) : null,
    channels.slackWebhookUrl ? ("slack" as const) : null,
    channels.lineUserId && env.notify.lineChannelAccessToken ? ("line" as const) : null,
  ].filter((channel): channel is Channel => channel !== null);
}

/** Which channels the server is configured for at all — the settings page greys the rest out. */
export function availableChannels(): Record<Channel, boolean> {
  return {
    email: canSendEmail(),
    slack: true,
    line: canLinkLine(),
  };
}

/**
 * Sends one notification everywhere the account asked for it. A channel that
 * fails is reported, never thrown: the in-app copy is already stored, and one
 * dead webhook must not stop the email from going out.
 */
export async function deliver(
  account: { email: string; notificationChannels?: NotificationChannels },
  notification: OutgoingNotification,
): Promise<DeliveryResult[]> {
  const channels = account.notificationChannels;
  const sends = activeChannels(channels).map(async (channel): Promise<DeliveryResult> => {
    try {
      if (channel === "email") await sendEmail(account.email, notification);
      if (channel === "slack") await sendSlack(channels!.slackWebhookUrl!, notification);
      if (channel === "line") await sendLine(channels!.lineUserId!, notification);
      return { channel, ok: true };
    } catch (error) {
      return { channel, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  return Promise.all(sends);
}
