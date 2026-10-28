import { createHash, randomBytes } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { canSendEmail, escapeHtml, sendEmail } from "../common/email";
import { env } from "../config/env";
import { AuthTokenPurpose, DatabaseService } from "../database/database.service";

/** How long each kind of link works for. */
export const LINK_TTL_MS: Record<AuthTokenPurpose, number> = {
  // Short: a reset link in an inbox is a key to the account.
  "password-reset": 60 * 60 * 1000,
  "email-verify": 24 * 60 * 60 * 1000,
};

const PAGES: Record<AuthTokenPurpose, string> = {
  "password-reset": "/reset-password",
  "email-verify": "/verify-email",
};

const MAIL: Record<AuthTokenPurpose, { subject: string; intro: string; action: string; expiry: string }> = {
  "password-reset": {
    subject: "ตั้งรหัสผ่านใหม่ — TOR Finder",
    intro: "มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ กดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่",
    action: "ตั้งรหัสผ่านใหม่",
    expiry: "ลิงก์นี้ใช้ได้ครั้งเดียว ภายใน 1 ชั่วโมง ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้",
  },
  "email-verify": {
    subject: "ยืนยันอีเมล — TOR Finder",
    intro: "ขอบคุณที่สมัครใช้งาน TOR Finder กดลิงก์ด้านล่างเพื่อยืนยันว่าอีเมลนี้เป็นของคุณ",
    action: "ยืนยันอีเมล",
    expiry: "ลิงก์นี้ใช้ได้ครั้งเดียว ภายใน 24 ชั่วโมง",
  },
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Single-use links sent by email: a password reset, an address check. The
 * token is 32 random bytes and only its hash is stored; using a link deletes
 * it in the same operation that reads it, so it can't be used twice, and
 * issuing a new one retires the older ones of the same kind.
 */
@Injectable()
export class AccountLinksService {
  private readonly logger = new Logger(AccountLinksService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Issues a link and mails it. Mail failures are logged, never thrown: the caller's answer can't depend on them. */
  async send(user: { _id: ObjectId; email: string }, purpose: AuthTokenPurpose): Promise<void> {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    await this.db.authTokens.deleteMany({ userId: user._id, purpose });
    await this.db.authTokens.insertOne({
      userId: user._id,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + LINK_TTL_MS[purpose]),
      createdAt: now,
    });

    const link = `${env.frontendOrigin}${PAGES[purpose]}?token=${token}`;
    if (!canSendEmail()) {
      // A developer's checkout has no mail key: print the link so the flow can still be followed.
      if (env.isProduction) this.logger.warn(`No RESEND_API_KEY: ${purpose} email to ${user.email} not sent`);
      else this.logger.warn(`No RESEND_API_KEY — ${purpose} link for ${user.email}: ${link}`);
      return;
    }

    const mail = MAIL[purpose];
    try {
      await sendEmail({
        to: user.email,
        subject: mail.subject,
        text: [mail.intro, link, mail.expiry].join("\n\n"),
        html: `<p>${escapeHtml(mail.intro)}</p><p><a href="${escapeHtml(link)}">${escapeHtml(mail.action)}</a></p><p style="color:#6b7280;font-size:13px">${escapeHtml(mail.expiry)}</p>`,
      });
    } catch (error) {
      this.logger.warn(`${purpose} email to ${user.email} failed: ${String(error)}`);
    }
  }

  /** The account a live link belongs to, deleting the link as it is read; null when unknown, used or expired. */
  async consume(token: string, purpose: AuthTokenPurpose): Promise<ObjectId | null> {
    const doc = await this.db.authTokens.findOneAndDelete({
      tokenHash: hashToken(token),
      purpose,
      // The TTL sweep runs once a minute; an expired link must fail before it.
      expiresAt: { $gt: new Date() },
    });
    return doc?.userId ?? null;
  }
}
