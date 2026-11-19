import { createHash, randomBytes } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { canSendEmail, escapeHtml, sendEmail } from "../common/email";
import { env } from "../config/env";
import { DatabaseService, EmailLinkPurpose } from "../database/database.service";

/** How long each kind of link works for. */
export const LINK_TTL_MS: Record<EmailLinkPurpose, number> = {
  // Short: a reset link in an inbox is a key to the account.
  "password-reset": 60 * 60 * 1000,
  "email-verify": 24 * 60 * 60 * 1000,
};

const PAGES: Record<EmailLinkPurpose, string> = {
  "password-reset": "/reset-password",
  "email-verify": "/verify-email",
};

const MAIL: Record<EmailLinkPurpose, { subject: string; intro: string; action: string; expiry: string }> = {
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

/** Account notices: no link to act on, just telling the address's owner what happened. */
export type AccountNotice =
  | "password-changed"
  | "google-linked"
  | "signup-existing"
  | "passkey-added"
  | "passkey-removed"
  | "passkeys-reset"
  | "login-locked";

const NOTICES: Record<AccountNotice, { subject: string; body: (origin: string) => string[] }> = {
  // ASVS 6.3.7
  "password-changed": {
    subject: "รหัสผ่านของคุณถูกเปลี่ยนแล้ว — TOR Finder",
    body: (origin) => [
      "รหัสผ่านของบัญชี TOR Finder ที่ใช้อีเมลนี้เพิ่งถูกเปลี่ยน และทุกอุปกรณ์ที่เข้าสู่ระบบอยู่ถูกออกจากระบบแล้ว",
      `ถ้าคุณไม่ได้เปลี่ยนเอง กรุณาตั้งรหัสผ่านใหม่ทันทีที่ ${origin}/forgot-password และแจ้งผู้ดูแลระบบ`,
    ],
  },
  // ASVS 6.3.7
  "google-linked": {
    subject: "บัญชี Google ถูกเชื่อมกับบัญชีของคุณ — TOR Finder",
    body: (origin) => [
      "บัญชี TOR Finder ที่ใช้อีเมลนี้เพิ่งถูกเข้าสู่ระบบด้วย Google เป็นครั้งแรก ต่อจากนี้จะเข้าสู่ระบบด้วย Google ได้ด้วย",
      `ถ้าคุณไม่ได้ทำเอง กรุณาเปลี่ยนรหัสผ่านบัญชี Google ของคุณ ตั้งรหัสผ่าน TOR Finder ใหม่ที่ ${origin}/forgot-password และแจ้งผู้ดูแลระบบ`,
    ],
  },
  // ASVS 6.3.7: a passkey is a way into the account, like a password.
  "passkey-added": {
    subject: "มีการเพิ่มพาสคีย์ในบัญชีของคุณ — TOR Finder",
    body: (origin) => [
      "มีการเพิ่มพาสคีย์ใหม่ในบัญชี TOR Finder ที่ใช้อีเมลนี้ ต่อจากนี้พาสคีย์นี้ใช้ยืนยันตัวตนตอนเข้าสู่ระบบได้",
      `ถ้าคุณไม่ได้เพิ่มเอง กรุณาแจ้งผู้ดูแลระบบทันทีเพื่อล้างพาสคีย์ และตั้งรหัสผ่านใหม่ที่ ${origin}/forgot-password`,
    ],
  },
  "passkey-removed": {
    subject: "มีการลบพาสคีย์ออกจากบัญชีของคุณ — TOR Finder",
    body: (origin) => [
      "มีการลบพาสคีย์ออกจากบัญชี TOR Finder ที่ใช้อีเมลนี้",
      `ถ้าคุณไม่ได้ลบเอง กรุณาแจ้งผู้ดูแลระบบทันที และตั้งรหัสผ่านใหม่ที่ ${origin}/forgot-password`,
    ],
  },
  "passkeys-reset": {
    subject: "ผู้ดูแลระบบล้างพาสคีย์ของคุณแล้ว — TOR Finder",
    body: (origin) => [
      "ผู้ดูแลระบบได้ล้างพาสคีย์ทั้งหมดของบัญชี TOR Finder ที่ใช้อีเมลนี้ และออกจากระบบทุกอุปกรณ์แล้ว",
      `เข้าสู่ระบบที่ ${origin}/login แล้วเพิ่มพาสคีย์ใหม่ ถ้าคุณไม่ได้ขอให้ล้าง กรุณาติดต่อผู้ดูแลระบบ`,
    ],
  },
  // ASVS 6.3.5: someone used up the address's sign-in tries; its owner should know.
  "login-locked": {
    subject: "มีการพยายามเข้าสู่ระบบบัญชีของคุณ — TOR Finder",
    body: (origin) => [
      "มีการกรอกรหัสผ่านผิดหลายครั้งติดกันสำหรับบัญชี TOR Finder ที่ใช้อีเมลนี้ ระบบจึงพักการเข้าสู่ระบบด้วยรหัสผ่านไว้ 15 นาที",
      `ถ้าเป็นคุณ รอ 15 นาทีแล้วลองใหม่ หรือตั้งรหัสผ่านใหม่ที่ ${origin}/forgot-password`,
      "ถ้าไม่ใช่คุณ รหัสผ่านของคุณยังไม่ถูกเปิดเผย แต่ควรตั้งรหัสผ่านใหม่ที่ไม่ซ้ำกับเว็บไซต์อื่น และแจ้งผู้ดูแลระบบหากเกิดขึ้นบ่อย",
    ],
  },
  // ASVS 6.3.8: the signup form answers as if it worked, so the owner is told here instead.
  "signup-existing": {
    subject: "มีการสมัครด้วยอีเมลของคุณ — TOR Finder",
    body: (origin) => [
      "มีคนพยายามสมัครบัญชี TOR Finder ด้วยอีเมลนี้ แต่อีเมลนี้มีบัญชีอยู่แล้ว จึงไม่มีการสร้างบัญชีใหม่",
      `ถ้าเป็นคุณ เข้าสู่ระบบได้ที่ ${origin}/login หรือถ้าลืมรหัสผ่าน ตั้งใหม่ได้ที่ ${origin}/forgot-password`,
      "ถ้าไม่ใช่คุณ ไม่ต้องทำอะไร บัญชีของคุณไม่มีการเปลี่ยนแปลง",
    ],
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
  async send(
    user: { _id: ObjectId; email: string },
    purpose: EmailLinkPurpose,
    options: { intro?: string } = {},
  ): Promise<void> {
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

    const mail = { ...MAIL[purpose], ...(options.intro && { intro: options.intro }) };
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

  /** Mails a notice to the address. Like send(), failures are logged and never change the caller's answer. */
  async notify(email: string, notice: AccountNotice): Promise<void> {
    if (!canSendEmail()) {
      if (env.isProduction) this.logger.warn(`No RESEND_API_KEY: ${notice} notice to ${email} not sent`);
      return;
    }
    const { subject, body } = NOTICES[notice];
    const paragraphs = body(env.frontendOrigin);
    try {
      await sendEmail({
        to: email,
        subject,
        text: paragraphs.join("\n\n"),
        html: paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join(""),
      });
    } catch (error) {
      this.logger.warn(`${notice} notice to ${email} failed: ${String(error)}`);
    }
  }

  /** The account a live link belongs to, without using it up — to check a new password before the link is spent. */
  async peek(token: string, purpose: EmailLinkPurpose): Promise<ObjectId | null> {
    const doc = await this.db.authTokens.findOne(
      { tokenHash: hashToken(token), purpose, expiresAt: { $gt: new Date() } },
      { projection: { userId: 1 } },
    );
    return doc?.userId ?? null;
  }

  /** The account a live link belongs to, deleting the link as it is read; null when unknown, used or expired. */
  async consume(token: string, purpose: EmailLinkPurpose): Promise<ObjectId | null> {
    const doc = await this.db.authTokens.findOneAndDelete({
      tokenHash: hashToken(token),
      purpose,
      // The TTL sweep runs once a minute; an expired link must fail before it.
      expiresAt: { $gt: new Date() },
    });
    return doc?.userId ?? null;
  }
}
