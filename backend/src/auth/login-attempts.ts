import { HttpException, HttpStatus } from "@nestjs/common";
import type { Collection } from "mongodb";

import { clearCounter, hitCounter, readCounter, type RateCounterDoc } from "../common/shared-counters";
import { TtlCache } from "../common/ttl-cache";
import { env } from "../config/env";

/** Plenty for every address being guessed at once; the oldest are dropped first. */
const MAX_TRACKED_ADDRESSES = 10_000;

const keyOf = (email: string) => `login-failures:${email}`;

/**
 * Counts failed logins per email address (ASVS 6.3.1). The IP throttle on the
 * route can be dodged by an attacker who rotates or spoofs addresses; this
 * cannot, because it is keyed on the account being guessed.
 *
 * Every failure restarts the window, so an address is unlocked only after a
 * quiet spell of `loginFailureWindowMs`. Unknown addresses are counted too, so
 * the 429 says nothing about which emails have accounts.
 *
 * The count lives in MongoDB's `rateCounters` collection, so it survives a
 * restart and is shared by every backend process (docs/SECURITY.md G4). Unit
 * tests that hand AuthService a stand-in database without that collection
 * get the in-memory count instead.
 */
export class LoginAttempts {
  private readonly memory = new TtlCache<string, number>(env.throttle.loginFailureWindowMs, MAX_TRACKED_ADDRESSES);

  constructor(private readonly counters: () => Collection<RateCounterDoc> | undefined = () => undefined) {}

  /** Refuses before the password is even checked once the address has used up its tries. */
  async assertAllowed(email: string): Promise<void> {
    if ((await this.count(email)) >= env.throttle.loginFailureLimit) {
      throw new HttpException(
        "ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่ หรือกดลืมรหัสผ่าน",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Counts a failure; true when this one used up the last try, i.e. the address has just been locked. */
  async recordFailure(email: string): Promise<boolean> {
    const counters = this.counters();
    let count: number;
    if (counters) {
      count = (await hitCounter(counters, keyOf(email), env.throttle.loginFailureWindowMs, { sliding: true })).hits;
    } else {
      count = (this.memory.get(email) ?? 0) + 1;
      this.memory.set(email, count);
    }
    return count === env.throttle.loginFailureLimit;
  }

  /** A correct password clears the count, so the owner isn't punished for an attacker's guesses after signing in. */
  async recordSuccess(email: string): Promise<void> {
    const counters = this.counters();
    if (counters) await clearCounter(counters, keyOf(email));
    else this.memory.delete(email);
  }

  private async count(email: string): Promise<number> {
    const counters = this.counters();
    return counters ? readCounter(counters, keyOf(email)) : (this.memory.get(email) ?? 0);
  }
}
