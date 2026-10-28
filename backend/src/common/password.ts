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

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return { hash: derivedKey.toString("hex"), salt };
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
