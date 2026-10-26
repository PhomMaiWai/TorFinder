import { env } from "../config/env";
import { NotificationChannels } from "../database/database.service";

export type Channel = "email" | "slack" | "line";

export type OutgoingNotification = {
  title: string;
  message: string;
  /** A page on the site to open, when the notification is about one. */
  link?: string;
};

export type DeliveryResult = { channel: Channel; ok: boolean; error?: string };

/** Each outside service gets this long before the attempt is given up on. */
const TIMEOUT_MS = 8_000;

/** Slack only ever issues incoming webhooks on this host. */
export const SLACK_WEBHOOK = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;
/** LINE ids: U… for a user, C… for a group, R… for a room, then 32 hex digits. */
export const LINE_ID = /^[UCR][0-9a-f]{32}$/;

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

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function sendEmail(to: string, notification: OutgoingNotification): Promise<void> {
  const { title, message, link } = notification;
  return post(
    "https://api.resend.com/emails",
    {
      from: env.notify.emailFrom,
      to: [to],
      subject: title,
      text: plainText(notification),
      html: `<p>${escapeHtml(message)}</p>${link ? `<p><a href="${escapeHtml(link)}">เปิดดูใน TOR Finder</a></p>` : ""}`,
    },
    { Authorization: `Bearer ${env.notify.resendApiKey}` },
  );
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
    channels.email && env.notify.resendApiKey ? ("email" as const) : null,
    channels.slackWebhookUrl ? ("slack" as const) : null,
    channels.lineUserId && env.notify.lineChannelAccessToken ? ("line" as const) : null,
  ].filter((channel): channel is Channel => channel !== null);
}

/** Which channels the server is configured for at all — the settings page greys the rest out. */
export function availableChannels(): Record<Channel, boolean> {
  return {
    email: Boolean(env.notify.resendApiKey),
    slack: true,
    line: Boolean(env.notify.lineChannelAccessToken),
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
