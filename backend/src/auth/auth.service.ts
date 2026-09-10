import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";
import { MongoServerError, WithId } from "mongodb";

import { hashPassword, verifyPassword } from "../common/password";
import { createSessionToken } from "../common/token";
import { env } from "../config/env";
import { DatabaseService, UserDoc } from "../database/database.service";
import { GoogleAuthDto } from "./dto/google-auth.dto";
import { GoogleCompleteSignupDto } from "./dto/google-complete-signup.dto";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";

const DUPLICATE_KEY = 11000;

// A dedicated client per request would re-fetch Google's signing keys every
// time; the library caches them internally, so one shared instance is correct.
const googleClient = new OAuth2Client(env.googleClientId);

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async signup({ email, password, ...company }: SignupDto) {
    const { hash, salt } = await hashPassword(password);

    try {
      await this.db.users.insertOne({
        email: email.trim().toLowerCase(),
        name: company.companyName,
        role: "org",
        // Every organization starts pending; an admin decides from /admin/accounts.
        status: "pending",
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date(),
        company,
      });
    } catch (error) {
      // The unique index on email is what actually guards against duplicates —
      // checking first would still race between two concurrent signups.
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        throw new ConflictException("อีเมลนี้ถูกใช้สมัครแล้ว");
      }
      throw error;
    }

    return { status: "pending" as const, companyName: company.companyName };
  }

  async login({ email, password }: LoginDto) {
    const user = await this.db.users.findOne({ email: email.trim().toLowerCase() });

    // No passwordHash means the account was created via Google and never set
    // one — verifyPassword can't run against nothing, so it's a mismatch too.
    if (
      !user ||
      !user.passwordHash ||
      !user.passwordSalt ||
      !(await verifyPassword(password, user.passwordSalt, user.passwordHash))
    ) {
      throw new UnauthorizedException("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }

    return this.issueSession(user);
  }

  async googleAuth({ credential }: GoogleAuthDto) {
    const { email, googleId, name } = await this.verifyGoogleCredential(credential);
    const user = await this.findOrLinkGoogleUser(googleId, email);

    if (!user) {
      // A Google identity we've never seen, with no existing account to link
      // to — Google only verifies who they are, not what company they run,
      // so the account can't be created yet. The caller collects that next,
      // via googleCompleteSignup().
      return { status: "needs-company-info" as const, email, name: name ?? email };
    }

    if (user.status === "pending") {
      return { status: "pending" as const, companyName: user.company?.companyName ?? user.name };
    }

    return this.issueSession(user);
  }

  /**
   * Second half of a brand-new Google sign-up: identity was already verified
   * by googleAuth(), and the caller has now supplied the company info Google
   * never had. Re-verifies the credential rather than trusting a client-held
   * claim of who they are.
   */
  async googleCompleteSignup({ credential, ...company }: GoogleCompleteSignupDto) {
    const { email, googleId, name } = await this.verifyGoogleCredential(credential);
    const user = await this.findOrLinkGoogleUser(googleId, email);

    if (user) {
      // Someone else finished signing this identity up in the meantime (a
      // second tab, or an email/password signup that just got linked) — the
      // company form on hand no longer applies, so report what's real.
      if (user.status === "pending") {
        return { status: "pending" as const, companyName: user.company?.companyName ?? user.name };
      }
      return this.issueSession(user);
    }

    const newUser: UserDoc = {
      email,
      name: name ?? company.companyName,
      role: "org",
      // Same as every other signup path: an admin decides from /admin/accounts.
      status: "pending",
      googleId,
      createdAt: new Date(),
      company,
    };

    try {
      await this.db.users.insertOne(newUser);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        throw new ConflictException("อีเมลนี้ถูกใช้สมัครแล้ว");
      }
      throw error;
    }

    return { status: "pending" as const, companyName: company.companyName };
  }

  /** A malformed or expired token throws — any rejection here means "not verified". */
  private async verifyGoogleCredential(credential: string) {
    const payload = await googleClient
      .verifyIdToken({ idToken: credential, audience: env.googleClientId })
      .then((ticket) => ticket.getPayload())
      .catch(() => null);

    if (!payload?.email) {
      throw new UnauthorizedException("ยืนยันบัญชี Google ไม่สำเร็จ");
    }

    return { email: payload.email.trim().toLowerCase(), googleId: payload.sub, name: payload.name };
  }

  /** Finds the account for this Google identity, linking it to a matching email/password account if one exists. */
  private async findOrLinkGoogleUser(googleId: string, email: string) {
    const user = await this.db.users.findOne({ googleId });
    if (user) return user;

    const existing = await this.db.users.findOne({ email });
    if (!existing) return null;

    await this.db.users.updateOne({ _id: existing._id }, { $set: { googleId } });
    return { ...existing, googleId };
  }

  private issueSession(user: WithId<UserDoc>) {
    // Checked only after identity is established, so the response can't be
    // used to probe which emails are registered. googleAuth() already
    // special-cases "pending" before reaching here — this only fires for
    // login(), where a pending account should look like a blocked sign-in.
    if (user.status === "pending") {
      throw new ForbiddenException("บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบตรวจสอบ");
    }
    if (user.status === "rejected") {
      throw new ForbiddenException("บัญชีของคุณไม่ผ่านการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ");
    }

    const token = createSessionToken({
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return {
      user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
      token,
    };
  }
}
