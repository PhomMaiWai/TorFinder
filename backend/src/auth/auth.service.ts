import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";

import { OAuth2Client } from "google-auth-library";
import { MongoServerError, ObjectId, WithId } from "mongodb";

import { needsRehash, passwordFields, passwordProblem, spendPasswordCheck, verifyPassword } from "../common/password";
import { logSecurityEvent, SecurityEvent } from "../common/security-log";
import { SessionRevocationService } from "../common/session-revocation.service";
import { AuthMethod, createSessionToken, SESSION_MAX_AGE_SECONDS, SessionPayload } from "../common/token";
import { env } from "../config/env";
import { DatabaseService, UserDoc } from "../database/database.service";
import { AccountLinksService } from "./account-links.service";
import { EmailOnlyDto, ResetPasswordDto, VerifyEmailDto } from "./dto/account-links.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { GoogleAuthDto } from "./dto/google-auth.dto";
import { GoogleCompleteSignupDto } from "./dto/google-complete-signup.dto";
import { googleClaimsProblem } from "./google-claims";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { LoginAttempts } from "./login-attempts";
import { ClientDevice, KnownDevice, MAX_KNOWN_DEVICES, NEW_DEVICE_SESSION_SECONDS, deviceHash, deviceLabel } from "./known-devices";
import { isStaffRole } from "../common/roles";
import { PasskeysService } from "./passkeys.service";
import { SIGN_IN_FIELDS } from "./sign-in-fields";

const DUPLICATE_KEY = 11000;

/** Told to the client so it can offer to resend the link, rather than a dead end. */
export const EMAIL_UNVERIFIED = "email-unverified";

/** The one answer to "send me a link": the same whether or not the address has an account. */
const LINK_SENT = { ok: true as const };

// A dedicated client per request would re-fetch Google's signing keys every
// time; the library caches them internally, so one shared instance is correct.
const googleClient = new OAuth2Client(env.googleClientId);

/** How recent a sign-in (or passkey check) must be to end sessions without a password (ASVS 7.5.2). */
const REAUTH_MINUTES = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly loginAttempts = new LoginAttempts(() => this.db.rateCounters);

  constructor(
    private readonly db: DatabaseService,
    private readonly links: AccountLinksService,
    private readonly revocation: SessionRevocationService,
    private readonly passkeys: PasskeysService,
  ) {}

  async signup({ email, password, ...company }: SignupDto, ip?: string) {
    // ASVS 6.2.4 / 6.2.11: reject passwords that would fall to a first-pass
    // dictionary attack or are built on this site's or the account's own words,
    // before they're ever hashed.
    const problem = passwordProblem(password, { email, companyName: company.companyName });
    if (problem) throw new BadRequestException(problem);
    const hashed = await passwordFields(password);
    const address = email.trim().toLowerCase();

    let userId: ObjectId;
    try {
      ({ insertedId: userId } = await this.db.users.insertOne({
        email: address,
        name: company.companyName,
        role: "org",
        // Every organization starts pending; an admin decides from /admin/accounts.
        status: "pending",
        ...hashed,
        createdAt: new Date(),
        company,
        emailVerified: false,
      }));
    } catch (error) {
      // The unique index on email is what actually guards against duplicates —
      // checking first would still race between two concurrent signups.
      // The answer is the same as a new signup, so the form can't be used to
      // find out who has an account (ASVS 6.3.8); the address's owner gets an
      // email saying someone tried, and how to sign in or reset instead.
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        logSecurityEvent("auth.signup", { outcome: "failure", email: address, ip, reason: "duplicate_email" });
        await this.links.notify(address, "signup-existing");
        return { status: "pending" as const, companyName: company.companyName };
      }
      throw error;
    }

    logSecurityEvent("auth.signup", { outcome: "success", userId: userId.toString(), email: address, ip });
    await this.links.send({ _id: userId, email: address }, "email-verify");
    return { status: "pending" as const, companyName: company.companyName };
  }

  async login({ email, password }: LoginDto, ip?: string, device: ClientDevice = {}) {
    const address = email.trim().toLowerCase();
    await this.assertNotLocked(address, ip);
    const user = await this.db.users.findOne({ email: address }, { projection: SIGN_IN_FIELDS });

    // No passwordHash means the account was created via Google and never set
    // one — verifyPassword can't run against nothing, so it's a mismatch too.
    // Every path pays for one scrypt, so the response time doesn't reveal
    // whether the address has an account (ASVS 6.3.8).
    const valid =
      user?.passwordHash && user.passwordSalt
        ? await verifyPassword(password, user.passwordSalt, user.passwordHash, user.passwordParams)
        : await spendPasswordCheck(password);
    if (!user || !valid) {
      await this.recordPasswordFailure(address, user, ip);
      logSecurityEvent("auth.login", {
        outcome: "failure",
        email: address,
        ip,
        reason: user ? "bad_credentials" : "unknown_account",
      });
      throw new UnauthorizedException("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    await this.loginAttempts.recordSuccess(address);
    // ASVS 11.4.2: a hash made with older, weaker settings is redone now, while
    // the plain password is in hand; it can't be upgraded any other way.
    if (needsRehash(user.passwordParams)) {
      await this.db.users.updateOne({ _id: user._id }, { $set: await passwordFields(password) });
    }
    // After the password, so only the account's owner learns its address is unconfirmed.
    if (user.emailVerified === false) {
      logSecurityEvent("auth.login", {
        outcome: "failure",
        userId: user._id.toString(),
        email: address,
        ip,
        reason: "email_unverified",
      });
      throw new ForbiddenException({
        statusCode: 403,
        message: "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ โดยกดลิงก์ที่ส่งไปทางอีเมล",
        code: EMAIL_UNVERIFIED,
      });
    }

    return this.issueSession(user, "auth.login", ip, "pwd", device);
  }

  /**
   * Mails a reset link when the address has an account. The answer is the
   * same either way, so the form can't be used to find out who has one.
   * Works for a Google-only account too: the link proves the same inbox.
   */
  async forgotPassword({ email }: EmailOnlyDto, ip?: string) {
    const address = email.trim().toLowerCase();
    const user = await this.db.users.findOne({ email: address }, { projection: { email: 1, suspended: 1 } });
    // Logged whether or not the address has an account; the response stays the same either way.
    logSecurityEvent("auth.password.reset.request", {
      outcome: "success",
      userId: user?._id.toString(),
      email: address,
      ip,
      reason: user ? (user.suspended ? "suspended_no_mail" : undefined) : "unknown_account",
    });
    if (user && !user.suspended) await this.links.send(user, "password-reset");
    return LINK_SENT;
  }

  /** Sets the new password. The link also proves the inbox, so the address counts as verified. */
  async resetPassword({ token, password }: ResetPasswordDto, ip?: string) {
    const invalidLink = () => {
      logSecurityEvent("auth.password.reset", { outcome: "failure", ip, reason: "invalid_or_expired_link" });
      return new BadRequestException("ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่");
    };
    // Checked before the link is used up, so a refused password doesn't cost the user their link.
    const owner = await this.links.peek(token, "password-reset");
    if (!owner) throw invalidLink();
    const account = await this.db.users.findOne({ _id: owner }, { projection: { email: 1, company: 1 } });
    const problem = passwordProblem(password, {
      email: account?.email,
      companyName: account?.company?.companyName,
    });
    if (problem) throw new BadRequestException(problem);

    const fields = { ...(await passwordFields(password)), emailVerified: true };
    // The link is used up, the password set and every session ended together,
    // or none of it happens (ASVS 2.3.3).
    const userId = await this.db.transaction(async (session) => {
      const id = await this.links.consume(token, "password-reset", session);
      if (!id) throw invalidLink();
      await this.db.users.updateOne({ _id: id }, { $set: fields }, { session });
      // Proves the account's owner is back in control, so any token issued
      // before now — including one an attacker who triggered this might hold —
      // stops working (ASVS 7.4.3).
      await this.revocation.revoke(id.toString(), session);
      return id;
    });
    logSecurityEvent("auth.password.reset", { outcome: "success", userId: userId.toString(), ip });
    // ASVS 6.3.7: the owner hears about it even if someone else used the link.
    if (account?.email) await this.links.notify(account.email, "password-changed");
    return { ok: true as const };
  }

  /**
   * A signed-in user replaces their password, proving they still know the
   * current one (ASVS 6.2.2 / 6.2.3) — a stolen session alone can't lock the
   * owner out. Wrong guesses count toward the same per-address limit as login.
   * Every session ends afterwards, this one included, so a token someone else
   * may hold stops working and the caller signs in again with the new password.
   */
  // ---- the account's own sessions (ASVS 7.5.2) ------------------------------

  /** This account's live sessions, newest first; `current` marks the one asking. */
  async listSessions(session: SessionPayload) {
    if (!ObjectId.isValid(session.sub)) return { needsPassword: false, sessions: [] };
    const user = await this.db.users.findOne(
      { _id: new ObjectId(session.sub) },
      { projection: { sessionMinIssuedAt: 1, passwordHash: 1 } },
    );
    const floor = user?.sessionMinIssuedAt ?? new Date(0);
    const docs = await this.db.sessions
      .find({ userId: new ObjectId(session.sub), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() }, createdAt: { $gte: floor } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return {
      // Whether ending a session asks for the password (see assertReauthenticated).
      needsPassword: !!user?.passwordHash,
      sessions: docs.map((doc) => ({
        id: doc._id,
        device: doc.device ?? null,
        // An IPv4 client reaches Node as "::ffff:a.b.c.d"; show the address people know.
        ip: doc.ip?.replace(/^::ffff:(?=\d+\.)/, "") ?? null,
        createdAt: doc.createdAt.toISOString(),
        current: doc._id === session.sid,
      })),
    };
  }

  /**
   * Ends one of this account's sessions, or all the others. ASVS 7.5.2 asks
   * for authentication again first: the current password when the account has
   * one, otherwise a sign-in or passkey check in the last REAUTH_MINUTES.
   */
  async endSessions(session: SessionPayload, target: { sid: string } | "others", password: string | undefined, ip?: string) {
    await this.assertReauthenticated(session, password, ip);
    if (target === "others") {
      const result = await this.db.sessions.updateMany(
        { userId: new ObjectId(session.sub), _id: { $ne: session.sid ?? "" }, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
      );
      // A token from before session ids existed carries no sid; the floor ends those, and re-signs nothing else.
      logSecurityEvent("auth.session.revoke", { outcome: "success", userId: session.sub, ip, reason: `others:${result.modifiedCount}` });
      return { ok: true as const, ended: result.modifiedCount };
    }
    const ended = await this.revocation.revokeSession(session.sub, target.sid);
    if (!ended) throw new BadRequestException("ไม่พบอุปกรณ์นี้ หรืออุปกรณ์นี้ออกจากระบบแล้ว");
    logSecurityEvent("auth.session.revoke", { outcome: "success", userId: session.sub, ip, reason: target.sid === session.sid ? "current" : "one" });
    return { ok: true as const, ended: 1 };
  }

  private async assertReauthenticated(session: SessionPayload, password: string | undefined, ip?: string) {
    const user = ObjectId.isValid(session.sub) ? await this.db.users.findOne({ _id: new ObjectId(session.sub) }) : null;
    if (!user) throw new UnauthorizedException("กรุณาเข้าสู่ระบบ");
    if (user.passwordHash && user.passwordSalt) {
      await this.assertNotLocked(user.email, ip);
      if (typeof password === "string" && password && (await verifyPassword(password, user.passwordSalt, user.passwordHash, user.passwordParams))) {
        return;
      }
      if (password) await this.recordPasswordFailure(user.email, user, ip);
      logSecurityEvent("auth.session.revoke", { outcome: "failure", userId: session.sub, ip, reason: password ? "wrong_password" : "reauth_required" });
      throw new ForbiddenException({ statusCode: 403, code: "reauth-required", message: "กรุณายืนยันรหัสผ่านปัจจุบันก่อนออกจากระบบอุปกรณ์อื่น" });
    }
    const now = Math.floor(Date.now() / 1000);
    const recent = now - session.iat <= REAUTH_MINUTES * 60 || (typeof session.pkt === "number" && now - session.pkt <= REAUTH_MINUTES * 60);
    if (recent) return;
    logSecurityEvent("auth.session.revoke", { outcome: "failure", userId: session.sub, ip, reason: "reauth_required" });
    throw new ForbiddenException({ statusCode: 403, code: "reauth-required", message: "กรุณาเข้าสู่ระบบอีกครั้งก่อนออกจากระบบอุปกรณ์อื่น" });
  }

  async changePassword(userId: string, { currentPassword, newPassword }: ChangePasswordDto, ip?: string) {
    const user = ObjectId.isValid(userId) ? await this.db.users.findOne({ _id: new ObjectId(userId) }, { projection: SIGN_IN_FIELDS }) : null;
    if (!user) throw new UnauthorizedException("กรุณาเข้าสู่ระบบ");
    if (!user.passwordHash || !user.passwordSalt) {
      // A Google-only account has no current password to prove; the emailed reset link sets a first one.
      throw new BadRequestException("บัญชีนี้ยังไม่มีรหัสผ่าน กรุณาใช้ \"ลืมรหัสผ่าน\" เพื่อตั้งรหัสผ่าน");
    }

    await this.assertNotLocked(user.email, ip);
    if (!(await verifyPassword(currentPassword, user.passwordSalt, user.passwordHash, user.passwordParams))) {
      await this.recordPasswordFailure(user.email, user, ip);
      logSecurityEvent("auth.password.change", {
        outcome: "failure",
        userId,
        email: user.email,
        ip,
        reason: "wrong_current_password",
      });
      // 400 rather than 401: the session is fine, only the typed password is wrong.
      throw new BadRequestException("รหัสผ่านปัจจุบันไม่ถูกต้อง");
    }
    await this.loginAttempts.recordSuccess(user.email);

    if (newPassword === currentPassword) {
      throw new BadRequestException("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน");
    }
    const problem = passwordProblem(newPassword, { email: user.email, companyName: user.company?.companyName });
    if (problem) throw new BadRequestException(problem);

    const fields = await passwordFields(newPassword);
    // The new password and the sign-out everywhere land together (ASVS 2.3.3).
    await this.db.transaction(async (session) => {
      await this.db.users.updateOne({ _id: user._id }, { $set: fields }, { session });
      await this.revocation.revoke(userId, session);
    });
    logSecurityEvent("auth.password.change", { outcome: "success", userId, email: user.email, ip });
    // ASVS 6.3.7: a stolen session plus a guessed password would otherwise go unnoticed.
    await this.links.notify(user.email, "password-changed");
    return { ok: true as const };
  }

  /** Invalidates every session token already issued to this account (ASVS 7.4.1). */
  async logout(userId: string, ip?: string): Promise<void> {
    await this.revocation.revoke(userId);
    logSecurityEvent("auth.logout", { outcome: "success", userId, ip });
  }

  /** Confirms the address. Says whether the account still waits on an admin, so the page can say so. */
  async verifyEmail({ token }: VerifyEmailDto, ip?: string) {
    const userId = await this.links.consume(token, "email-verify");
    if (!userId) {
      logSecurityEvent("auth.email.verify", { outcome: "failure", ip, reason: "invalid_or_expired_link" });
      throw new BadRequestException("ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่");
    }
    logSecurityEvent("auth.email.verify", { outcome: "success", userId: userId.toString(), ip });

    const user = await this.db.users.findOneAndUpdate(
      { _id: userId },
      { $set: { emailVerified: true } },
      { returnDocument: "after", projection: { status: 1 } },
    );
    return { ok: true as const, status: user?.status ?? "approved" };
  }

  /** Mails a fresh verification link to an address still waiting on one; same answer otherwise. */
  async resendVerification({ email }: EmailOnlyDto) {
    const user = await this.db.users.findOne(
      { email: email.trim().toLowerCase(), emailVerified: false },
      { projection: { email: 1 } },
    );
    if (user) await this.links.send(user, "email-verify");
    return LINK_SENT;
  }

  async googleAuth({ credential, nonce, as }: GoogleAuthDto, ip?: string, device: ClientDevice = {}) {
    const { email, googleId, name } = await this.verifyGoogleCredential(credential, nonce, ip);
    const user = await this.findOrLinkGoogleUser(googleId, email);

    // An existing account always signs in as itself, whichever button was
    // pressed — a company owner using the public button still lands as org.
    if (!user && as === "viewer") {
      const viewer = await this.createViewer(googleId, email, name ?? email);
      // A new account, so it is logged as a sign-up, like the password and company paths (ASVS 16.3.1).
      logSecurityEvent("auth.signup", { outcome: "success", userId: viewer._id.toString(), email, ip, role: "viewer", reason: "google" });
      return this.issueSession(viewer, "auth.google", ip, "google", device);
    }

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

    return this.issueSession(user, "auth.google", ip, "google", device);
  }

  /**
   * Second half of a brand-new Google sign-up: identity was already verified
   * by googleAuth(), and the caller has now supplied the company info Google
   * never had. Re-verifies the credential rather than trusting a client-held
   * claim of who they are.
   */
  async googleCompleteSignup({ credential, nonce, ...company }: GoogleCompleteSignupDto, ip?: string, device: ClientDevice = {}) {
    const { email, googleId, name } = await this.verifyGoogleCredential(credential, nonce, ip);
    const user = await this.findOrLinkGoogleUser(googleId, email);

    if (user) {
      // Someone else finished signing this identity up in the meantime (a
      // second tab, or an email/password signup that just got linked) — the
      // company form on hand no longer applies, so report what's real.
      if (user.status === "pending") {
        return { status: "pending" as const, companyName: user.company?.companyName ?? user.name };
      }
      return this.issueSession(user, "auth.google", ip, "google", device);
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
      // Google only hands over addresses it has verified (see verifyGoogleCredential).
      emailVerified: true,
    };

    let userId: ObjectId;
    try {
      ({ insertedId: userId } = await this.db.users.insertOne(newUser));
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        logSecurityEvent("auth.signup", { outcome: "failure", email, ip, reason: "google_duplicate_email" });
        throw new ConflictException("อีเมลนี้ถูกใช้สมัครแล้ว");
      }
      throw error;
    }

    // Logged like the password sign-up, so every new account leaves a line in the security log (ASVS 16.3.1).
    logSecurityEvent("auth.signup", { outcome: "success", userId: userId.toString(), email, ip, role: "org", reason: "google" });
    return { status: "pending" as const, companyName: company.companyName };
  }

  /** A malformed or expired token throws — any rejection here means "not verified". */
  private async verifyGoogleCredential(credential: string, nonce: string, ip?: string) {
    const payload = await googleClient
      .verifyIdToken({ idToken: credential, audience: env.googleClientId })
      .then((ticket) => ticket.getPayload())
      .catch(() => null);

    // Signature, audience and expiry were checked above; the claims here
    // (nonce bound to this browser, Google-verified email) see google-claims.ts.
    const problem = googleClaimsProblem(payload, nonce);
    if (problem || !payload?.email) {
      logSecurityEvent("auth.google", { outcome: "failure", ip, reason: problem ?? "invalid_google_token" });
      throw new UnauthorizedException("ยืนยันบัญชี Google ไม่สำเร็จ");
    }

    return { email: payload.email.trim().toLowerCase(), googleId: payload.sub, name: payload.name };
  }

  /**
   * Viewers only read public data, so there is nothing for an admin to review:
   * the account is approved the moment Google vouches for the identity.
   */
  private async createViewer(googleId: string, email: string, name: string) {
    const doc: UserDoc = {
      email,
      name,
      role: "viewer",
      status: "approved",
      googleId,
      createdAt: new Date(),
      emailVerified: true,
    };
    try {
      const { insertedId } = await this.db.users.insertOne(doc);
      return { ...doc, _id: insertedId };
    } catch (error) {
      // Two tabs finishing sign-in at once: the unique index let one insert
      // through, so sign in as the account the other one created.
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        const existing = await this.db.users.findOne({ googleId }, { projection: SIGN_IN_FIELDS });
        if (existing) return existing;
      }
      throw error;
    }
  }

  /** Finds the account for this Google identity, linking it to a matching email/password account if one exists. */
  private async findOrLinkGoogleUser(googleId: string, email: string) {
    const user = await this.db.users.findOne({ googleId }, { projection: SIGN_IN_FIELDS });
    if (user) return user;

    const existing = await this.db.users.findOne({ email }, { projection: SIGN_IN_FIELDS });
    if (!existing) return null;

    // Google has just proven this inbox, which settles any pending address check too.
    await this.db.users.updateOne({ _id: existing._id }, { $set: { googleId, emailVerified: true } });
    // A new way into the account (ASVS 6.3.7): tell the owner, in case it wasn't them.
    await this.links.notify(existing.email, "google-linked");
    return { ...existing, googleId, emailVerified: true };
  }

  /** The per-address lock, logged when it refuses (ASVS 6.3.1, 16.3.1). */
  /**
   * Counts a wrong password. The failure that locks a real account also emails
   * its owner (ASVS 6.3.5), once per lock. The mail is not awaited: an unknown
   * address sends nothing, so waiting would let the response time tell which
   * addresses have accounts (ASVS 6.3.8). notify() never throws.
   */
  private async recordPasswordFailure(address: string, user: { _id: ObjectId; email: string } | null, ip?: string): Promise<void> {
    const justLocked = await this.loginAttempts.recordFailure(address);
    if (!justLocked || !user) return;
    logSecurityEvent("auth.login.lockout", { outcome: "failure", userId: user._id.toString(), email: address, ip, reason: "owner_notified" });
    void this.links.notify(user.email, "login-locked");
  }

  private async assertNotLocked(email: string, ip?: string): Promise<void> {
    try {
      await this.loginAttempts.assertAllowed(email);
    } catch (error) {
      logSecurityEvent("auth.login.locked", { outcome: "failure", email, ip, reason: "too_many_failures" });
      throw error;
    }
  }

  /**
   * The first factor passed. Staff with a passkey are handed its challenge
   * instead of a session (ASVS 6.3.3); everyone else gets their session now.
   */
  private async issueSession(
    user: WithId<UserDoc>,
    event: SecurityEvent,
    ip: string | undefined,
    factor: "pwd" | "google",
    device: ClientDevice = {},
  ) {
    this.assertCanSignIn(user, event, ip);
    if (PasskeysService.needsPasskey(user)) {
      logSecurityEvent(event, {
        outcome: "success",
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        ip,
        reason: "passkey_pending",
      });
      return { status: "passkey-required" as const, options: await this.passkeys.startLogin(user, factor) };
    }
    return this.createSession(user, event, ip, [factor], undefined, device);
  }

  /** Step two of a staff sign-in: the passkey signed the challenge from issueSession. */
  async completePasskeyLogin(response: Parameters<PasskeysService["finishLogin"]>[0], ip?: string, device: ClientDevice = {}) {
    const { user, amr } = await this.passkeys.finishLogin(response, ip);
    // Checked again: the account may have been suspended in the minutes between the two steps.
    this.assertCanSignIn(user, "auth.passkey.login", ip);
    return this.createSession(user, "auth.passkey.login", ip, amr, Math.floor(Date.now() / 1000), device);
  }

  /** Throws when the account may not sign in at all, whatever the credentials. */
  private assertCanSignIn(user: WithId<UserDoc>, event: SecurityEvent, ip?: string): void {
    const refuse = (reason: string) =>
      logSecurityEvent(event, { outcome: "failure", userId: user._id.toString(), email: user.email, ip, reason });
    // Checked only after identity is established, so the response can't be
    // used to probe which emails are registered. googleAuth() already
    // special-cases "pending" before reaching here — this only fires for
    // login(), where a pending account should look like a blocked sign-in.
    if (user.status === "pending") {
      refuse("account_pending");
      throw new ForbiddenException("บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบตรวจสอบ");
    }
    if (user.status === "rejected") {
      refuse("account_rejected");
      throw new ForbiddenException("บัญชีของคุณไม่ผ่านการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ");
    }
    // Orthogonal to status: an admin can block an already-approved account
    // without reversing the approval itself (see AccountsService.setSuspended).
    if (user.suspended) {
      refuse("account_suspended");
      throw new ForbiddenException("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
    }
  }

  private async createSession(
    user: WithId<UserDoc>,
    event: SecurityEvent,
    ip: string | undefined,
    amr: AuthMethod[],
    pkt?: number,
    device: ClientDevice = {},
  ) {
    // Best-effort: a write hiccup here must never block a real sign-in, same
    // posture as EgpService's sync-run recording and AuditService.record.
    let newDevice = false;
    try {
      await this.db.users.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
      newDevice = await this.noteDevice(user, device, ip);
    } catch (error) {
      this.logger.warn(`Failed to record sign-in for ${user.email}: ${String(error)}`);
    }

    // ASVS 8.2.4: a session from a device this account hasn't used before is
    // short (NEW_DEVICE_SESSION_SECONDS) instead of the usual 7 days. Its next
    // sign-in comes from a known device and gets the normal lifetime.
    const lifetimeSeconds = newDevice ? NEW_DEVICE_SESSION_SECONDS : SESSION_MAX_AGE_SECONDS;

    // ASVS 7.5.2: each session is recorded, so its owner can see it and end it
    // on its own. If the record can't be written the sign-in still works, as
    // a session without an id (ended only with all the account's others).
    const sid = randomBytes(16).toString("base64url");
    let recorded = true;
    try {
      const now = new Date();
      await this.db.sessions.insertOne({
        _id: sid,
        userId: user._id,
        createdAt: now,
        expiresAt: new Date(now.getTime() + lifetimeSeconds * 1000),
        device: deviceLabel(device.userAgent),
        ...(ip && { ip }),
        amr,
      });
    } catch (error) {
      recorded = false;
      this.logger.warn(`Failed to record session for ${user.email}: ${String(error)}`);
    }

    const token = createSessionToken(
      {
        sub: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        amr,
        ...(pkt !== undefined && { pkt }),
        ...(recorded && { sid }),
      },
      newDevice ? NEW_DEVICE_SESSION_SECONDS : undefined,
    );

    logSecurityEvent(event, {
      outcome: "success",
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      ip,
    });
    return {
      user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
      token,
    };
  }

  /**
   * ASVS 6.3.5: a successful sign-in from a browser this account hasn't used
   * before emails its owner, with when, which browser and from where, so a
   * sign-in they didn't make doesn't go unnoticed. Called only after every
   * factor passed, so it says nothing about failed tries (the lockout email
   * covers those).
   *
   * A browser is known by the random device cookie the frontend keeps, stored
   * here only as a hash, the last MAX_KNOWN_DEVICES of them per account. The
   * account's very first recorded browser sends nothing: that is its owner
   * signing up, or every existing account's first sign-in after this shipped,
   * and an email for each would teach people to ignore them. A sign-in with no
   * device id at all (a script calling the API) counts as new every time.
   */
  private async noteDevice(user: WithId<UserDoc>, device: ClientDevice, ip?: string): Promise<boolean> {
    const hash = deviceHash(device.id);
    const known = user.knownDevices ?? [];
    const now = new Date();

    if (hash && known.some((d) => d.hash === hash)) {
      await this.db.users.updateOne({ _id: user._id, "knownDevices.hash": hash }, { $set: { "knownDevices.$.lastSeenAt": now } });
      return false;
    }

    const label = deviceLabel(device.userAgent);
    if (hash) {
      const entry: KnownDevice = { hash, label, firstSeenAt: now, lastSeenAt: now };
      await this.db.users.updateOne(
        { _id: user._id },
        { $push: { knownDevices: { $each: [entry], $slice: -MAX_KNOWN_DEVICES } } },
      );
    }
    if (known.length === 0) return false;

    logSecurityEvent("auth.login.new_device", {
      outcome: "success",
      userId: user._id.toString(),
      email: user.email,
      ip,
      reason: hash ? "owner_notified" : "no_device_id",
    });
    const when = now.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "long", timeStyle: "short" });
    // Not awaited: the email must never hold up (or fail) the sign-in itself.
    const details = [`เวลา: ${when} (เวลาประเทศไทย)`, `เบราว์เซอร์: ${label}`, ...(ip ? [`IP: ${ip}`] : [])];
    void this.links.notify(user.email, "new-device", details);
    // ASVS 8.4.2: a staff account on a new device is something every other
    // admin should know about, not only its owner.
    if (isStaffRole(user.role)) void this.notifyAdmins(user, details);
    return true;
  }

  /** Emails every other admin about a staff sign-in from a new device. Never throws. */
  private async notifyAdmins(user: WithId<UserDoc>, details: string[]): Promise<void> {
    try {
      const admins = await this.db.users
        .find({ role: "admin", _id: { $ne: user._id }, suspended: { $ne: true } }, { projection: { email: 1 } })
        .toArray();
      await Promise.all(
        admins.map((admin) =>
          this.links.notify(admin.email, "staff-new-device", [`บัญชีเจ้าหน้าที่: ${user.name} (${user.email})`, ...details]),
        ),
      );
    } catch (error) {
      this.logger.warn(`Failed to tell admins about ${user.email}'s new device: ${String(error)}`);
    }
  }
}
