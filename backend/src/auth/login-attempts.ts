import { HttpException, HttpStatus } from "@nestjs/common";

import { TtlCache } from "../common/ttl-cache";
import { env } from "../config/env";

/** Plenty for every address being guessed at once; the oldest are dropped first. */
const MAX_TRACKED_ADDRESSES = 10_000;

/**
 * Counts failed logins per email address (ASVS 6.3.1). The IP throttle on the
 * route can be dodged by an attacker who rotates or spoofs addresses; this
 * cannot, because it is keyed on the account being guessed.
 *
 * Every failure restarts the window, so an address is unlocked only after a
 * quiet spell of `loginFailureWindowMs`. Unknown addresses are counted too, so
 * the 429 says nothing about which emails have accounts. Per process, like the
 * route throttle (see docs/design/api.md, "Rate limits are per process").
 */
export class LoginAttempts {
  private readonly failures = new TtlCache<string, number>(
    env.throttle.loginFailureWindowMs,
    MAX_TRACKED_ADDRESSES,
  );

  /** Refuses before the password is even checked once the address has used up its tries. */
  assertAllowed(email: string): void {
    if ((this.failures.get(email) ?? 0) >= env.throttle.loginFailureLimit) {
      throw new HttpException(
        "ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่ หรือกดลืมรหัสผ่าน",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(email: string): void {
    this.failures.set(email, (this.failures.get(email) ?? 0) + 1);
  }

  /** A correct password clears the count, so the owner isn't punished for an attacker's guesses after signing in. */
  recordSuccess(email: string): void {
    this.failures.delete(email);
  }
}
