import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";
import { MongoServerError, WithId } from "mongodb";

import { hashPassword, verifyPassword } from "../common/password";
import { createSessionToken } from "../common/token";
import { env } from "../config/env";
import { DatabaseService, UserDoc } from "../database/database.service";
import { GoogleAuthDto } from "./dto/google-auth.dto";
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
    // A malformed or expired token throws rather than failing gracefully —
    // any rejection here means the same thing to the caller: not verified.
    const payload = await googleClient
      .verifyIdToken({ idToken: credential, audience: env.googleClientId })
      .then((ticket) => ticket.getPayload())
      .catch(() => null);

    if (!payload?.email) {
      throw new UnauthorizedException("ยืนยันบัญชี Google ไม่สำเร็จ");
    }

    const email = payload.email.trim().toLowerCase();
    const googleId = payload.sub;

    let user = await this.db.users.findOne({ googleId });

    if (!user) {
      // Not seen this Google account before — is there already an
      // email/password account to link it to, instead of duplicating?
      const existing = await this.db.users.findOne({ email });
      if (existing) {
        await this.db.users.updateOne({ _id: existing._id }, { $set: { googleId } });
        user = { ...existing, googleId };
      }
    }

    if (!user) {
      const newUser: UserDoc = {
        email,
        name: payload.name ?? email,
        role: "org",
        // Same as every other signup path: an admin decides from /admin/accounts.
        status: "pending",
        googleId,
        createdAt: new Date(),
      };
      await this.db.users.insertOne(newUser);
      // Newly created (or newly linked) — the caller has never seen a
      // pending-review notice for this account before, so it should look
      // like a fresh signup confirmation rather than a blocked sign-in.
      return { status: "pending" as const, companyName: newUser.company?.companyName ?? newUser.name };
    }

    if (user.status === "pending") {
      return { status: "pending" as const, companyName: user.company?.companyName ?? user.name };
    }

    return this.issueSession(user);
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
