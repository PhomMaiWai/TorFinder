import { createHash } from "node:crypto";

/**
 * What the frontend says about the browser a sign-in came from (ASVS 6.3.5).
 * `id` is a random value the frontend keeps in an HttpOnly cookie for a year;
 * `userAgent` is the browser's own, used only to describe it in the email.
 */
export type ClientDevice = { id?: string; userAgent?: string };

/** One browser an account has signed in from. Only a hash of its cookie is kept. */
export type KnownDevice = {
  hash: string;
  /** e.g. "Chrome on macOS", for the account owner to recognise. */
  label: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

/** Enough for anyone's phones, laptops and browsers; the oldest falls off. */
export const MAX_KNOWN_DEVICES = 20;

/** 32 random bytes, base64url: what the frontend issues. Anything else is ignored. */
const DEVICE_ID = /^[A-Za-z0-9_-]{43}$/;

/** The stored form of a device id, or null when there is no usable one. */
export function deviceHash(id: string | undefined): string | null {
  return id && DEVICE_ID.test(id) ? createHash("sha256").update(id).digest("hex") : null;
}

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

/**
 * A short, human description of a user agent: "Chrome on macOS". Coarse on
 * purpose: it is only shown to the account's owner, never used to decide
 * anything, and an exact version would change with every browser update.
 */
export function deviceLabel(userAgent: string | undefined): string {
  if (!userAgent) return "เบราว์เซอร์ที่ไม่ทราบชื่อ";
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && system) return `${browser} บน ${system}`;
  return browser ?? system ?? "เบราว์เซอร์ที่ไม่ทราบชื่อ";
}
