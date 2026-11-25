import { createHash, randomBytes } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { ClientSession, ObjectId } from "mongodb";

import { canSendEmail, sendEmail } from "../common/email";
import { EmailTone, emailSubject, renderEmail } from "../common/email-layout";
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

/** One language's text of a link email. */
type LinkMailCopy = { subject: string; intro: string; action: string; expiry: string };

const MAIL: Record<EmailLinkPurpose, { th: LinkMailCopy; en: LinkMailCopy }> = {
  "password-reset": {
    th: {
      subject: "ตั้งรหัสผ่านใหม่",
      intro: "มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่",
      action: "ตั้งรหัสผ่านใหม่",
      expiry: "ลิงก์นี้ใช้ได้ครั้งเดียว ภายใน 1 ชั่วโมง ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้",
    },
    en: {
      subject: "Reset your password",
      intro: "Someone asked to reset the password for this account. Use the button below to set a new one.",
      action: "Reset password",
      expiry: "This link works once, within 1 hour. If you didn't ask for it, do nothing — your current password still works.",
    },
  },
  "email-verify": {
    th: {
      subject: "ยืนยันอีเมล",
      intro: "ขอบคุณที่สมัครใช้งาน TOR Finder กดปุ่มด้านล่างเพื่อยืนยันว่าอีเมลนี้เป็นของคุณ",
      action: "ยืนยันอีเมล",
      expiry: "ลิงก์นี้ใช้ได้ครั้งเดียว ภายใน 24 ชั่วโมง",
    },
    en: {
      subject: "Verify your email",
      intro: "Thanks for signing up for TOR Finder. Use the button below to confirm this email address is yours.",
      action: "Verify email",
      expiry: "This link works once, within 24 hours.",
    },
  },
};

/** The intro an admin-sent reset link uses instead of the self-service one. */
export const ADMIN_RESET_INTRO = {
  th: "ผู้ดูแลระบบ TOR Finder ส่งลิงก์ตั้งรหัสผ่านใหม่ให้บัญชีนี้ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ด้วยตัวเอง ผู้ดูแลระบบไม่เห็นและไม่ได้กำหนดรหัสผ่านของคุณ",
  en: "A TOR Finder administrator sent this account a password reset link. Use the button below to set a new password yourself — the administrator neither sees nor chooses it.",
};

/** Account notices: no link to act on, just telling the address's owner what happened. */
export type AccountNotice =
  | "password-changed"
  | "google-linked"
  | "signup-existing"
  | "passkey-added"
  | "passkey-removed"
  | "passkeys-reset"
  | "login-locked"
  | "new-device"
  | "staff-new-device"
  | "account-approved"
  | "account-rejected";

/** One language's text of a notice. The first paragraph is the opening; the details box follows it. */
type NoticeCopy = { subject: string; body: (origin: string) => string[]; action?: string };

type Notice = {
  th: NoticeCopy;
  en: NoticeCopy;
  /** Where the button goes, for a notice that has one obvious next step (labels are in th/en `action`). */
  actionUrl?: (origin: string) => string;
  tone?: EmailTone;
};

const NOTICES: Record<AccountNotice, Notice> = {
  // The company can't sign in while pending, so it can't have turned on email
  // alerts yet — the review outcome is mailed directly, whatever its settings.
  "account-approved": {
    th: {
      subject: "บัญชีบริษัทของคุณได้รับการอนุมัติแล้ว",
      body: () => [
        "ผู้ดูแลระบบตรวจสอบและอนุมัติบัญชีบริษัทของคุณใน TOR Finder เรียบร้อยแล้ว",
        "เข้าสู่ระบบเพื่อค้นหา TOR ที่ตรงกับบริษัท บันทึกรายการที่สนใจ และรับแจ้งเตือนเมื่อมี TOR ใหม่ได้ทันที",
      ],
      action: "เข้าสู่ระบบ",
    },
    en: {
      subject: "Your company account is approved",
      body: () => [
        "An administrator has reviewed and approved your company account on TOR Finder.",
        "Sign in to find TORs that match your company, save the ones you're interested in, and get alerts when new TORs are published.",
      ],
      action: "Sign in",
    },
    actionUrl: (origin) => `${origin}/login`,
    tone: "success",
  },
  "account-rejected": {
    th: {
      subject: "บัญชีบริษัทของคุณไม่ผ่านการอนุมัติ",
      body: () => [
        "ผู้ดูแลระบบตรวจสอบแล้ว บัญชีบริษัทของคุณใน TOR Finder ไม่ผ่านการอนุมัติ",
        "หากคิดว่าเป็นความผิดพลาด หรือต้องการทราบเหตุผลเพิ่มเติม กรุณาติดต่อผู้ดูแลระบบ",
      ],
    },
    en: {
      subject: "Your company account was not approved",
      body: () => [
        "An administrator has reviewed your company account on TOR Finder and did not approve it.",
        "If you think this is a mistake, or would like to know why, please contact the administrator.",
      ],
    },
    tone: "danger",
  },
  // ASVS 6.3.7
  "password-changed": {
    th: {
      subject: "รหัสผ่านของคุณถูกเปลี่ยนแล้ว",
      body: (origin) => [
        "รหัสผ่านของบัญชี TOR Finder ที่ใช้อีเมลนี้เพิ่งถูกเปลี่ยน และทุกอุปกรณ์ที่เข้าสู่ระบบอยู่ถูกออกจากระบบแล้ว",
        `ถ้าคุณไม่ได้เปลี่ยนเอง กรุณาตั้งรหัสผ่านใหม่ทันทีที่ ${origin}/forgot-password และแจ้งผู้ดูแลระบบ`,
      ],
    },
    en: {
      subject: "Your password was changed",
      body: (origin) => [
        "The password for the TOR Finder account using this email was just changed, and every signed-in device has been signed out.",
        `If you didn't change it, reset your password now at ${origin}/forgot-password and tell the administrator.`,
      ],
    },
  },
  // ASVS 6.3.7
  "google-linked": {
    th: {
      subject: "บัญชี Google ถูกเชื่อมกับบัญชีของคุณ",
      body: (origin) => [
        "บัญชี TOR Finder ที่ใช้อีเมลนี้เพิ่งถูกเข้าสู่ระบบด้วย Google เป็นครั้งแรก ต่อจากนี้จะเข้าสู่ระบบด้วย Google ได้ด้วย",
        `ถ้าคุณไม่ได้ทำเอง กรุณาเปลี่ยนรหัสผ่านบัญชี Google ของคุณ ตั้งรหัสผ่าน TOR Finder ใหม่ที่ ${origin}/forgot-password และแจ้งผู้ดูแลระบบ`,
      ],
    },
    en: {
      subject: "A Google account was linked to your account",
      body: (origin) => [
        "The TOR Finder account using this email was just signed in to with Google for the first time. From now on it can also sign in with Google.",
        `If this wasn't you, change your Google account's password, reset your TOR Finder password at ${origin}/forgot-password, and tell the administrator.`,
      ],
    },
  },
  // ASVS 6.3.7: a passkey is a way into the account, like a password.
  "passkey-added": {
    th: {
      subject: "มีการเพิ่มพาสคีย์ในบัญชีของคุณ",
      body: (origin) => [
        "มีการเพิ่มพาสคีย์ใหม่ในบัญชี TOR Finder ที่ใช้อีเมลนี้ ต่อจากนี้พาสคีย์นี้ใช้ยืนยันตัวตนตอนเข้าสู่ระบบได้",
        `ถ้าคุณไม่ได้เพิ่มเอง กรุณาแจ้งผู้ดูแลระบบทันทีเพื่อล้างพาสคีย์ และตั้งรหัสผ่านใหม่ที่ ${origin}/forgot-password`,
      ],
    },
    en: {
      subject: "A passkey was added to your account",
      body: (origin) => [
        "A new passkey was added to the TOR Finder account using this email. It can now be used to verify sign-ins.",
        `If you didn't add it, tell the administrator right away so they can remove it, and reset your password at ${origin}/forgot-password.`,
      ],
    },
  },
  "passkey-removed": {
    th: {
      subject: "มีการลบพาสคีย์ออกจากบัญชีของคุณ",
      body: (origin) => [
        "มีการลบพาสคีย์ออกจากบัญชี TOR Finder ที่ใช้อีเมลนี้",
        `ถ้าคุณไม่ได้ลบเอง กรุณาแจ้งผู้ดูแลระบบทันที และตั้งรหัสผ่านใหม่ที่ ${origin}/forgot-password`,
      ],
    },
    en: {
      subject: "A passkey was removed from your account",
      body: (origin) => [
        "A passkey was removed from the TOR Finder account using this email.",
        `If you didn't remove it, tell the administrator right away and reset your password at ${origin}/forgot-password.`,
      ],
    },
  },
  "passkeys-reset": {
    th: {
      subject: "ผู้ดูแลระบบล้างพาสคีย์ของคุณแล้ว",
      body: (origin) => [
        "ผู้ดูแลระบบได้ล้างพาสคีย์ทั้งหมดของบัญชี TOR Finder ที่ใช้อีเมลนี้ และออกจากระบบทุกอุปกรณ์แล้ว",
        `เข้าสู่ระบบที่ ${origin}/login แล้วเพิ่มพาสคีย์ใหม่ ถ้าคุณไม่ได้ขอให้ล้าง กรุณาติดต่อผู้ดูแลระบบ`,
      ],
    },
    en: {
      subject: "An administrator cleared your passkeys",
      body: (origin) => [
        "An administrator removed every passkey from the TOR Finder account using this email and signed it out on all devices.",
        `Sign in at ${origin}/login and add a new passkey. If you didn't ask for this, please contact the administrator.`,
      ],
    },
  },
  // ASVS 6.3.5: someone used up the address's sign-in tries; its owner should know.
  "login-locked": {
    th: {
      subject: "มีการพยายามเข้าสู่ระบบบัญชีของคุณ",
      body: (origin) => [
        "มีการกรอกรหัสผ่านผิดหลายครั้งติดกันสำหรับบัญชี TOR Finder ที่ใช้อีเมลนี้ ระบบจึงพักการเข้าสู่ระบบด้วยรหัสผ่านไว้ 15 นาที",
        `ถ้าเป็นคุณ รอ 15 นาทีแล้วลองใหม่ หรือตั้งรหัสผ่านใหม่ที่ ${origin}/forgot-password`,
        "ถ้าไม่ใช่คุณ รหัสผ่านของคุณยังไม่ถูกเปิดเผย แต่ควรตั้งรหัสผ่านใหม่ที่ไม่ซ้ำกับเว็บไซต์อื่น และแจ้งผู้ดูแลระบบหากเกิดขึ้นบ่อย",
      ],
    },
    en: {
      subject: "Someone tried to sign in to your account",
      body: (origin) => [
        "The wrong password was entered several times in a row for the TOR Finder account using this email, so password sign-in is paused for 15 minutes.",
        `If this was you, wait 15 minutes and try again, or reset your password at ${origin}/forgot-password.`,
        "If it wasn't you, your password has not been revealed, but you should set a new one that you don't use on other sites, and tell the administrator if it keeps happening.",
      ],
    },
  },
  "new-device": {
    th: {
      subject: "มีการเข้าสู่ระบบจากอุปกรณ์ใหม่",
      body: (origin) => [
        "บัญชี TOR Finder ที่ใช้อีเมลนี้เพิ่งเข้าสู่ระบบจากเบราว์เซอร์หรืออุปกรณ์ที่ไม่เคยใช้มาก่อน",
        "ถ้าเป็นคุณ ไม่ต้องทำอะไร",
        `ถ้าไม่ใช่คุณ กรุณาตั้งรหัสผ่านใหม่ทันทีที่ ${origin}/forgot-password (ทุกอุปกรณ์จะถูกออกจากระบบ) และแจ้งผู้ดูแลระบบ`,
      ],
    },
    en: {
      subject: "New sign-in from a new device",
      body: (origin) => [
        "The TOR Finder account using this email just signed in from a browser or device it hasn't used before.",
        "If this was you, there's nothing to do.",
        `If it wasn't you, reset your password now at ${origin}/forgot-password (every device will be signed out) and tell the administrator.`,
      ],
    },
  },
  // ASVS 8.4.2: told to every other admin when a staff account signs in from a new device.
  "staff-new-device": {
    th: {
      subject: "บัญชีเจ้าหน้าที่เข้าสู่ระบบจากอุปกรณ์ใหม่",
      body: (origin) => [
        "บัญชีเจ้าหน้าที่ต่อไปนี้เพิ่งเข้าสู่ระบบ TOR Finder จากเบราว์เซอร์หรืออุปกรณ์ที่ไม่เคยใช้มาก่อน เซสชันนี้จะหมดอายุภายใน 12 ชั่วโมง",
        "ถ้าเป็นการเข้าสู่ระบบที่ทราบอยู่แล้ว ไม่ต้องทำอะไร",
        `ถ้าไม่แน่ใจ ติดต่อเจ้าของบัญชี และหากจำเป็น ระงับสิทธิ์หรือล้างพาสคีย์ได้ที่ ${origin}/admin/users`,
      ],
    },
    en: {
      subject: "A staff account signed in from a new device",
      body: (origin) => [
        "The staff account below just signed in to TOR Finder from a browser or device it hasn't used before. The session expires within 12 hours.",
        "If you already know about this sign-in, there's nothing to do.",
        `If you're not sure, contact the account's owner and, if needed, suspend it or clear its passkeys at ${origin}/admin/users.`,
      ],
    },
  },
  // ASVS 6.3.8: the signup form answers as if it worked, so the owner is told here instead.
  "signup-existing": {
    th: {
      subject: "มีการสมัครด้วยอีเมลของคุณ",
      body: (origin) => [
        "มีคนพยายามสมัครบัญชี TOR Finder ด้วยอีเมลนี้ แต่อีเมลนี้มีบัญชีอยู่แล้ว จึงไม่มีการสร้างบัญชีใหม่",
        `ถ้าเป็นคุณ เข้าสู่ระบบได้ที่ ${origin}/login หรือถ้าลืมรหัสผ่าน ตั้งใหม่ได้ที่ ${origin}/forgot-password`,
        "ถ้าไม่ใช่คุณ ไม่ต้องทำอะไร บัญชีของคุณไม่มีการเปลี่ยนแปลง",
      ],
    },
    en: {
      subject: "Someone signed up with your email",
      body: (origin) => [
        "Someone tried to create a TOR Finder account with this email, but it already has an account, so no new one was created.",
        `If this was you, sign in at ${origin}/login, or reset a forgotten password at ${origin}/forgot-password.`,
        "If it wasn't you, there's nothing to do — your account hasn't changed.",
      ],
    },
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
    options: { intro?: { th: string; en: string } } = {},
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

    const { th, en } = MAIL[purpose];
    try {
      const { html, text } = renderEmail({
        th: { heading: th.subject, paragraphs: [options.intro?.th ?? th.intro], buttonLabel: th.action, footnote: th.expiry },
        en: { heading: en.subject, paragraphs: [options.intro?.en ?? en.intro], buttonLabel: en.action, footnote: en.expiry },
        buttonUrl: link,
      });
      await sendEmail({ to: user.email, subject: emailSubject(th.subject, en.subject), text, html });
    } catch (error) {
      this.logger.warn(`${purpose} email to ${user.email} failed: ${String(error)}`);
    }
  }

  /**
   * Mails a notice to the address, in Thai and English. Like send(), failures
   * are logged and never change the caller's answer. `details` are label/value
   * rows (e.g. when and from which browser), shown in a box after the Thai
   * text; write each label in both languages.
   */
  async notify(email: string, notice: AccountNotice, details: [string, string][] = []): Promise<void> {
    if (!canSendEmail()) {
      if (env.isProduction) this.logger.warn(`No RESEND_API_KEY: ${notice} notice to ${email} not sent`);
      return;
    }
    const { th, en, actionUrl, tone } = NOTICES[notice];
    const origin = env.frontendOrigin;
    const { html, text } = renderEmail({
      th: { heading: th.subject, paragraphs: th.body(origin), buttonLabel: th.action },
      en: { heading: en.subject, paragraphs: en.body(origin), buttonLabel: en.action },
      details,
      buttonUrl: actionUrl?.(origin),
      tone,
    });
    try {
      await sendEmail({ to: email, subject: emailSubject(th.subject, en.subject), text, html });
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
  async consume(token: string, purpose: EmailLinkPurpose, session?: ClientSession): Promise<ObjectId | null> {
    const doc = await this.db.authTokens.findOneAndDelete(
      {
        tokenHash: hashToken(token),
        purpose,
        // The TTL sweep runs once a minute; an expired link must fail before it.
        expiresAt: { $gt: new Date() },
      },
      { session },
    );
    return doc?.userId ?? null;
  }
}
