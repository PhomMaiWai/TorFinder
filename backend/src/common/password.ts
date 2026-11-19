import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { COMMON_PASSWORDS } from "./common-passwords";

// Async scrypt so hashing a password doesn't block the event loop for the
// ~100ms it takes — matters once login requests are concurrent.
const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

/**
 * ASVS 6.2.4: a password is rejected here before it's ever hashed if it's in
 * the breached/common-password set, regardless of length or composition.
 */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.trim().toLowerCase());
}

/**
 * ASVS 6.1.2: words tied to this application, its operator and its roles,
 * which an attacker would try first against a TorFinder account. Lower-case,
 * no spaces; documented in docs/security/asvs-l2.md.
 */
export const CONTEXT_WORDS: readonly string[] = [
  "torfinder",
  "torr",
  "bma",
  "bangkok",
  "krungthep",
  "กรุงเทพ",
  "กรุงเทพมหานคร",
  "กทม",
  "egp",
  "procurement",
  "จัดซื้อจัดจ้าง",
  "admin",
  "administrator",
  "auditor",
  "owner",
  "viewer",
  "organization",
];

/** A password is "built on" a word when what's left after removing it is shorter than this. */
const MIN_OTHER_CHARACTERS = 8;
/** Shorter personal words (an email like "a@b.co") would reject far too much. */
const MIN_PERSONAL_WORD = 4;

const squash = (text: string) => text.toLowerCase().replace(/\s+/g, "");
/** Letters and digits only (Latin and Thai), for counting what's left of a password. */
const meaningful = (text: string) => text.replace(/[^a-z0-9฀-๿]/g, "");

/** The account's own words: the email's name and domain, and the company name's words. */
function personalWords(context: PasswordContext): string[] {
  const [local = "", domain = ""] = (context.email ?? "").toLowerCase().split("@");
  const parts = [local, domain.split(".")[0], ...(context.companyName ?? "").toLowerCase().split(/\s+/)];
  return parts.map((part) => meaningful(part)).filter((part) => part.length >= MIN_PERSONAL_WORD);
}

export type PasswordContext = { email?: string; companyName?: string };

/**
 * ASVS 6.2.11: rejects a password made mostly of a context-specific word —
 * this application's words or the account's own email and company name —
 * plus a little padding ("TorFinder2026!", "somchai1234"). A long passphrase
 * that merely contains such a word still passes.
 */
export function isContextSpecificPassword(password: string, context: PasswordContext = {}): boolean {
  const candidate = squash(password);
  return [...CONTEXT_WORDS, ...personalWords(context)].some(
    (word) => candidate.includes(word) && meaningful(candidate.replace(word, "")).length < MIN_OTHER_CHARACTERS,
  );
}

/** Why a new password is refused, in the user's language, or null when it's acceptable. */
export function passwordProblem(password: string, context: PasswordContext = {}): string | null {
  if (isCommonPassword(password)) return "รหัสผ่านนี้พบได้ทั่วไปและคาดเดาง่ายเกินไป กรุณาตั้งรหัสผ่านอื่น";
  if (isContextSpecificPassword(password, context)) {
    return "รหัสผ่านนี้คาดเดาง่าย เพราะใช้ชื่อระบบ หน่วยงาน อีเมล หรือชื่อบริษัทเป็นส่วนใหญ่ กรุณาตั้งรหัสผ่านอื่น";
  }
  return null;
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return { hash: derivedKey.toString("hex"), salt };
}

/** A fixed salt for {@link spendPasswordCheck}; nothing is ever compared against its output. */
const TIMING_SALT = "00000000000000000000000000000000";

/**
 * Does the same scrypt work as verifyPassword and answers false. Login calls it
 * when the address has no account (or no password), so the response takes as
 * long as a wrong password would and its timing can't tell which addresses
 * are registered (ASVS 6.3.8).
 */
export async function spendPasswordCheck(password: string): Promise<false> {
  await scrypt(password, TIMING_SALT, KEY_LENGTH);
  return false;
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");
  return derivedKey.length === expected.length && timingSafeEqual(derivedKey, expected);
}
