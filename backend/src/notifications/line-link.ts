import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "../config/env";

/**
 * Linking a LINE account without anyone having to find their LINE user id
 * (the LINE app never shows it): the site hands out a short one-time code,
 * the user sends it to our Official Account, and the webhook LINE calls with
 * that message carries the sender's user id. Code in, id out, account linked.
 */

/** How long a code works for. */
export const LINK_TTL_MS = 10 * 60_000;

/** No 0/O, 1/I/L: the code is read off a screen and typed into a chat. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const PREFIX = "TF-";

/** A fresh code, e.g. "TF-K7QH2MXA" (~39 bits, alive for ten minutes). */
export function newLinkCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return PREFIX + code;
}

const CODE_MESSAGE = new RegExp(`^(?:TF-?)?([${ALPHABET}]{${CODE_LENGTH}})$`);

/**
 * The code a chat message is, if it is one. The whole message has to be the
 * code — anything else is ordinary chat — but typing slips are forgiven:
 * lower case, spaces, a missing "TF-".
 */
export function parseLinkCode(text: string): string | null {
  const match = text.toUpperCase().replace(/\s+/g, "").match(CODE_MESSAGE);
  return match ? PREFIX + match[1] : null;
}

/** Only the hash is stored, so a database read can't be turned into a link. */
export const hashLinkCode = (code: string) => createHash("sha256").update(code).digest("hex");

/** LINE signs each webhook body with the channel secret: base64(HMAC-SHA256). */
export function verifyLineSignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Linking needs the push token, the webhook secret and the OA's id to point people at. */
export const canLinkLine = () =>
  Boolean(env.notify.lineChannelAccessToken && env.notify.lineChannelSecret && env.notify.lineBotId);

/** Where the "connect" button sends people: LINE opens the OA chat with the code typed in. */
export function lineLinkUrls(code: string) {
  const id = encodeURIComponent(env.notify.lineBotId);
  return {
    addFriendUrl: `https://line.me/R/ti/p/${id}`,
    messageUrl: `https://line.me/R/oaMessage/${id}/?${encodeURIComponent(code)}`,
  };
}

/** Answers a message in the chat it came from. Replies are free; pushes count against the OA's quota. */
export async function replyLine(replyToken: string, text: string): Promise<void> {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.notify.lineChannelAccessToken}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
}

/** The parts of a webhook event this app reads. */
export type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type?: string; userId?: string };
  message?: { type?: string; text?: string };
};
