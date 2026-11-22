import { createHash } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { ClientSession, ObjectId, WithId } from "mongodb";

import { passkeyRequiredFor } from "../common/passkey-policy";
import { Role, isStaffRole } from "../common/roles";
import { logSecurityEvent } from "../common/security-log";
import { SessionRevocationService } from "../common/session-revocation.service";
import { StepUpRequiredException } from "../common/step-up.guard";
import { AuthMethod, SessionPayload, hasRecentPasskey, reissueSessionToken } from "../common/token";
import { env } from "../config/env";
import { AuthTokenPurpose, DatabaseService, StoredPasskey, UserDoc } from "../database/database.service";
import { AccountLinksService } from "./account-links.service";
import { SIGN_IN_FIELDS } from "./sign-in-fields";

/**
 * Who may add passkeys: staff (required in production, docs/security/passkeys.md)
 * and companies, for whom it is optional (ASVS 6.3.3 at Level 3). Once a
 * company adds one, its sign-in needs it too. Public viewers sign in with
 * Google only.
 */
const canUsePasskeys = (role: Role) => isStaffRole(role) || role === "org";

/**
 * Passkeys (WebAuthn) for staff accounts (admin and owner), and,
 * optionally, company accounts.
 *
 * A passkey is a key pair made by the user's device or security key. The
 * private key never leaves it, and the browser only lets it sign for our own
 * domain, so a look-alike phishing site gets nothing it can replay — what
 * ASVS 6.3.3 asks of Level 3. Used three ways:
 *
 * - **Sign-in.** After a correct password (or Google), a staff account with a
 *   passkey gets a challenge instead of a session; the session comes once the
 *   passkey signs it.
 * - **Step-up.** Sensitive admin actions need a passkey check in the last few
 *   minutes (ASVS 7.5.3); see StepUpGuard.
 * - **Enrolment.** A staff member adds passkeys from /account.
 *
 * Every challenge is 32 random bytes kept only as a SHA-256 hash in
 * `authTokens`, for one purpose and one account, for five minutes, and is
 * deleted as it is used — so it can be answered once, by that account only.
 */

/** How long the user has to touch their key once a challenge is issued. */
const CHALLENGE_TTL_MS = 5 * 60_000;
/** Enough for a laptop, a phone and two security keys, with room to spare. */
export const MAX_PASSKEYS = 10;
const RP_NAME = "TOR Finder";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** The passkey as the account page shows it; the public key and counter stay on the server. */
export type PasskeyView = { id: string; name: string; createdAt: Date; lastUsedAt?: Date };

const view = ({ id, name, createdAt, lastUsedAt }: StoredPasskey): PasskeyView => ({ id, name, createdAt, lastUsedAt });

/** The challenge the browser signed, read from the response's clientDataJSON; null when it isn't there. */
function challengeOf(response: { response?: { clientDataJSON?: unknown } } | undefined): string | null {
  const clientData = response?.response?.clientDataJSON;
  if (typeof clientData !== "string" || clientData.length > 4096) return null;
  try {
    const parsed = JSON.parse(Buffer.from(clientData, "base64url").toString("utf8")) as { challenge?: unknown };
    return typeof parsed.challenge === "string" ? parsed.challenge : null;
  } catch {
    return null;
  }
}

@Injectable()
export class PasskeysService {
  constructor(
    private readonly db: DatabaseService,
    private readonly links: AccountLinksService,
    private readonly revocation: SessionRevocationService,
  ) {}

  /** Whether this account must finish sign-in with a passkey. */
  static needsPasskey(user: Pick<UserDoc, "role" | "passkeys">): boolean {
    return canUsePasskeys(user.role) && (user.passkeys?.length ?? 0) > 0;
  }

  // ---- challenges -------------------------------------------------------

  private async storeChallenge(
    userId: ObjectId,
    purpose: AuthTokenPurpose,
    challenge: string,
    factor?: "pwd" | "google",
  ): Promise<void> {
    const now = new Date();
    // One live challenge per account and purpose: a new one retires the old.
    await this.db.authTokens.deleteMany({ userId, purpose });
    await this.db.authTokens.insertOne({
      userId,
      purpose,
      tokenHash: hash(challenge),
      expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
      createdAt: now,
      ...(factor && { factor }),
    });
  }

  /** Uses up the challenge the response answers, if it is live and (when given) this account's. */
  private async consumeChallenge(response: unknown, purpose: AuthTokenPurpose, userId?: ObjectId) {
    const challenge = challengeOf(response as { response?: { clientDataJSON?: unknown } });
    if (!challenge) return null;
    const doc = await this.db.authTokens.findOneAndDelete({
      tokenHash: hash(challenge),
      purpose,
      expiresAt: { $gt: new Date() },
      ...(userId && { userId }),
    });
    return doc ? { challenge, userId: doc.userId, factor: doc.factor } : null;
  }

  private async userOf(id: ObjectId | string): Promise<WithId<UserDoc>> {
    const user = ObjectId.isValid(id) ? await this.db.users.findOne({ _id: new ObjectId(id) }, { projection: SIGN_IN_FIELDS }) : null;
    if (!user) throw new UnauthorizedException("กรุณาเข้าสู่ระบบ");
    return user;
  }

  /** Checks a signed challenge against one of the account's own passkeys and records its use. */
  private async verifyAssertion(user: WithId<UserDoc>, response: AuthenticationResponseJSON, challenge: string) {
    const passkey = user.passkeys?.find((candidate) => candidate.id === response?.id);
    if (!passkey) return false;
    let result;
    try {
      result = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: env.passkeys.origin,
        expectedRPID: env.passkeys.rpId,
        credential: {
          id: passkey.id,
          publicKey: Buffer.from(passkey.publicKey, "base64url"),
          counter: passkey.counter,
          transports: passkey.transports as AuthenticatorTransportFuture[] | undefined,
        },
        // A touch is the user-initiated action ASVS 6.3.3 asks for; a PIN or
        // biometric on top is welcome but not every security key has one.
        requireUserVerification: false,
      });
    } catch {
      // Wrong origin, bad signature, a counter that went backwards (a cloned key)…
      return false;
    }
    if (!result.verified) return false;
    await this.db.users.updateOne(
      { _id: user._id, "passkeys.id": passkey.id },
      { $set: { "passkeys.$.counter": result.authenticationInfo.newCounter, "passkeys.$.lastUsedAt": new Date() } },
    );
    return true;
  }

  private authenticationOptions(user: WithId<UserDoc>): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return generateAuthenticationOptions({
      rpID: env.passkeys.rpId,
      allowCredentials: (user.passkeys ?? []).map(({ id, transports }) => ({
        id,
        transports: transports as AuthenticatorTransportFuture[] | undefined,
      })),
      userVerification: "preferred",
    });
  }

  // ---- sign-in ----------------------------------------------------------

  /** Step one of a staff sign-in, once the first factor passed: the challenge the passkey must sign. */
  async startLogin(user: WithId<UserDoc>, factor: "pwd" | "google"): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const options = await this.authenticationOptions(user);
    await this.storeChallenge(user._id, "passkey-login", options.challenge, factor);
    return options;
  }

  /**
   * Step two: the signed challenge. The challenge itself proves step one
   * passed — it is only ever issued after the first factor — and names the
   * account, so the request carries nothing else.
   */
  async finishLogin(
    response: AuthenticationResponseJSON,
    ip?: string,
  ): Promise<{ user: WithId<UserDoc>; amr: AuthMethod[] }> {
    const refused = (reason: string, userId?: string) => {
      logSecurityEvent("auth.passkey.login", { outcome: "failure", userId, ip, reason });
      return new UnauthorizedException("ยืนยันตัวตนด้วยพาสคีย์ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่");
    };
    const challenge = await this.consumeChallenge(response, "passkey-login");
    if (!challenge) throw refused("unknown_or_expired_challenge");
    const user = await this.db.users.findOne({ _id: challenge.userId }, { projection: SIGN_IN_FIELDS });
    if (!user) throw refused("unknown_account");
    if (!(await this.verifyAssertion(user, response, challenge.challenge))) {
      throw refused("bad_assertion", user._id.toString());
    }
    logSecurityEvent("auth.passkey.login", { outcome: "success", userId: user._id.toString(), email: user.email, ip });
    return { user, amr: [challenge.factor ?? "pwd", "passkey"] };
  }

  // ---- enrolment --------------------------------------------------------

  async list(userId: string): Promise<PasskeyView[]> {
    const user = await this.userOf(userId);
    return (user.passkeys ?? []).map(view);
  }

  /**
   * The options for adding a passkey. The first one only needs a signed-in
   * staff session (it is how a new staff member gets started; the owner is
   * emailed). Any further one needs a recent passkey check, so someone who
   * learns the password can't add their own key next to the owner's.
   */
  async registrationOptions(session: SessionPayload): Promise<PublicKeyCredentialCreationOptionsJSON> {
    if (!canUsePasskeys(session.role)) throw new ForbiddenException("พาสคีย์ใช้ได้กับบัญชีเจ้าหน้าที่และบัญชีบริษัทเท่านั้น");
    const user = await this.userOf(session.sub);
    const existing = user.passkeys ?? [];
    if (existing.length > 0 && !hasRecentPasskey(session, env.passkeys.stepUpMinutes)) {
      throw new StepUpRequiredException();
    }
    if (existing.length >= MAX_PASSKEYS) throw new ConflictException(`เพิ่มพาสคีย์ได้สูงสุด ${MAX_PASSKEYS} อัน`);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: env.passkeys.rpId,
      userID: new Uint8Array(user._id.id),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: "none",
      excludeCredentials: existing.map(({ id, transports }) => ({
        id,
        transports: transports as AuthenticatorTransportFuture[] | undefined,
      })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
    await this.storeChallenge(user._id, "passkey-register", options.challenge);
    return options;
  }

  /**
   * Saves the new passkey and hands back the session re-signed as
   * passkey-verified: the user has just proved they hold it.
   */
  async finishRegistration(
    session: SessionPayload,
    name: string,
    response: RegistrationResponseJSON,
    ip?: string,
  ): Promise<{ passkeys: PasskeyView[]; token: string }> {
    const user = await this.userOf(session.sub);
    const challenge = await this.consumeChallenge(response, "passkey-register", user._id);
    if (!challenge) throw new BadRequestException("คำขอเพิ่มพาสคีย์หมดอายุแล้ว กรุณาลองใหม่");

    let result;
    try {
      result = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: env.passkeys.origin,
        expectedRPID: env.passkeys.rpId,
        requireUserVerification: false,
      });
    } catch {
      result = null;
    }
    if (!result?.verified) {
      logSecurityEvent("auth.passkey.register", { outcome: "failure", userId: session.sub, ip, reason: "bad_attestation" });
      throw new BadRequestException("เพิ่มพาสคีย์ไม่สำเร็จ กรุณาลองใหม่");
    }

    const { credential } = result.registrationInfo;
    const passkey: StoredPasskey = {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      ...(credential.transports?.length && { transports: credential.transports }),
      name: name.trim().slice(0, 60) || "Passkey",
      createdAt: new Date(),
    };
    // The cap and the push are one step, so two tabs can't overshoot it.
    const saved = await this.db.users
      .updateOne(
        { _id: user._id, [`passkeys.${MAX_PASSKEYS - 1}`]: { $exists: false } },
        { $push: { passkeys: passkey } },
      )
      .catch((error: { code?: number }) => {
        // The unique index: this credential is already registered somewhere.
        if (error.code === 11000) throw new ConflictException("พาสคีย์นี้ลงทะเบียนไว้แล้ว");
        throw error;
      });
    if (saved.matchedCount === 0) throw new ConflictException(`เพิ่มพาสคีย์ได้สูงสุด ${MAX_PASSKEYS} อัน`);

    logSecurityEvent("auth.passkey.register", { outcome: "success", userId: session.sub, email: user.email, ip });
    await this.links.notify(user.email, "passkey-added");

    const amr = Array.from(new Set<AuthMethod>([...(session.amr ?? ["pwd"]), "passkey"]));
    return {
      passkeys: [...(user.passkeys ?? []), passkey].map(view),
      token: reissueSessionToken(session, { amr, pkt: Math.floor(Date.now() / 1000) }),
    };
  }

  /** Removes one of the caller's passkeys. Needs a recent passkey check; the last one stays while passkeys are required. */
  async remove(session: SessionPayload, id: string, ip?: string): Promise<PasskeyView[]> {
    if (!hasRecentPasskey(session, env.passkeys.stepUpMinutes)) throw new StepUpRequiredException();
    const user = await this.userOf(session.sub);
    const existing = user.passkeys ?? [];
    if (!existing.some((passkey) => passkey.id === id)) throw new NotFoundException("ไม่พบพาสคีย์นี้");
    if (passkeyRequiredFor(user.role) && existing.length === 1) {
      throw new ConflictException("บัญชีนี้ต้องมีพาสคีย์อย่างน้อยหนึ่งอัน กรุณาเพิ่มอันใหม่ก่อนลบอันนี้");
    }
    // Conditional on the count read above, so two parallel removals can't take the last one.
    const result = await this.db.users.updateOne(
      { _id: user._id, passkeys: { $size: existing.length } },
      { $pull: { passkeys: { id } } },
    );
    if (result.modifiedCount === 0) throw new ConflictException("พาสคีย์มีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง");

    logSecurityEvent("auth.passkey.remove", { outcome: "success", userId: session.sub, email: user.email, ip });
    await this.links.notify(user.email, "passkey-removed");
    return existing.filter((passkey) => passkey.id !== id).map(view);
  }

  // ---- step-up ----------------------------------------------------------

  async stepUpOptions(session: SessionPayload): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const user = await this.userOf(session.sub);
    if (!user.passkeys?.length) {
      throw new ConflictException({ code: "passkey-setup-required", message: "กรุณาเพิ่มพาสคีย์ในหน้าบัญชีของฉันก่อน" });
    }
    const options = await this.authenticationOptions(user);
    await this.storeChallenge(user._id, "passkey-step-up", options.challenge);
    return options;
  }

  /** The session re-signed with a fresh passkey check. */
  async finishStepUp(session: SessionPayload, response: AuthenticationResponseJSON, ip?: string): Promise<string> {
    const user = await this.userOf(session.sub);
    const challenge = await this.consumeChallenge(response, "passkey-step-up", user._id);
    if (!challenge || !(await this.verifyAssertion(user, response, challenge.challenge))) {
      logSecurityEvent("auth.step_up", { outcome: "failure", userId: session.sub, ip, reason: "bad_assertion" });
      throw new UnauthorizedException("ยืนยันตัวตนด้วยพาสคีย์ไม่สำเร็จ");
    }
    logSecurityEvent("auth.step_up", { outcome: "success", userId: session.sub, ip });
    const amr = Array.from(new Set<AuthMethod>([...(session.amr ?? ["pwd"]), "passkey"]));
    return reissueSessionToken(session, { amr, pkt: Math.floor(Date.now() / 1000) });
  }

  // ---- recovery ---------------------------------------------------------

  /**
   * An admin clears a staff member's passkeys — a lost phone or key. Every
   * session of theirs ends, and they add a new passkey at their next sign-in.
   * The caller has passed step-up; nobody can reset their own.
   */
  async resetFor(targetId: string, actor: SessionPayload, ip?: string, session?: ClientSession): Promise<WithId<UserDoc>> {
    if (targetId === actor.sub) throw new BadRequestException("ล้างพาสคีย์ของบัญชีตัวเองไม่ได้ ให้ผู้ดูแลระบบคนอื่นเป็นผู้ล้าง");
    const user = ObjectId.isValid(targetId)
      ? await this.db.users.findOneAndUpdate(
          { _id: new ObjectId(targetId) },
          { $unset: { passkeys: "" } },
          { returnDocument: "before", session },
        )
      : null;
    if (!user) throw new NotFoundException("ไม่พบบัญชีนี้");
    await this.revocation.revoke(targetId, session);
    await this.db.authTokens.deleteMany(
      { userId: user._id, purpose: { $in: ["passkey-login", "passkey-register", "passkey-step-up"] } },
      { session },
    );
    logSecurityEvent("auth.passkey.reset", {
      outcome: "success",
      userId: targetId,
      email: user.email,
      reason: `by_${actor.sub}`,
      ip,
    });
    return user;
  }

  /** After the reset has committed: the owner hears about it (ASVS 6.3.7). */
  async notifyReset(user: Pick<UserDoc, "email" | "passkeys">): Promise<void> {
    if (user.passkeys?.length) await this.links.notify(user.email, "passkeys-reset");
  }
}
