import { ConflictException, Injectable } from "@nestjs/common";
import { ClientSession, ObjectId } from "mongodb";

import { AuditService } from "../audit/audit.service";
import { Role } from "../common/roles";
import { SessionRevocationService } from "../common/session-revocation.service";
import { DatabaseService } from "../database/database.service";
import { NotificationsService } from "../notifications/notifications.service";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "ผู้ดูแลระบบ",
  org: "บริษัท",
  owner: "เจ้าของโครงการ",
  viewer: "ประชาชนทั่วไป",
};

export const LAST_ADMIN = "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน จึงเปลี่ยนบทบาทของผู้ดูแลระบบคนสุดท้ายไม่ได้";
export const CHANGED_MEANWHILE = "บัญชีนี้ถูกแก้ไขไปแล้ว กรุณาโหลดหน้าใหม่";

/**
 * What leaves the service about an account depends on who reads it (ASVS
 * 14.2.6, 11.7.2): never password material, passkeys, device hashes or
 * notification settings, and of a company's profile only what that reader
 * needs. One projection per audience:
 */

/**
 * A row in the admin's user directory, and the answer to an admin action on
 * one account. The company's name only: its contacts, team (CVs), past
 * projects and certificates aren't shown in the list.
 */
export const DIRECTORY_FIELDS = {
  email: 1,
  name: 1,
  role: 1,
  status: 1,
  suspended: 1,
  createdAt: 1,
  reviewedAt: 1,
  lastLoginAt: 1,
  "company.companyName": 1,
} as const;

/**
 * A company in the sign-up review queue: what an admin checks before
 * approving (who they are, how to reach them, what they do). Not its team
 * members, past projects, certificates or alert settings.
 */
export const REVIEW_FIELDS = {
  email: 1,
  name: 1,
  role: 1,
  status: 1,
  suspended: 1,
  createdAt: 1,
  reviewedAt: 1,
  "company.companyName": 1,
  "company.taxId": 1,
  "company.contactName": 1,
  "company.phone": 1,
  "company.address": 1,
  "company.specialty": 1,
  "company.size": 1,
  "company.techStack": 1,
  "company.workTypes": 1,
  "company.pastExperience": 1,
  "company.registeredCapital": 1,
} as const;

/** The account's own profile, read by its owner: the whole company profile. */
export const OWN_ACCOUNT_FIELDS = {
  email: 1,
  name: 1,
  role: 1,
  status: 1,
  suspended: 1,
  createdAt: 1,
  reviewedAt: 1,
  lastLoginAt: 1,
  company: 1,
} as const;

/** What a role change needs to know about the account as it was read. */
export type RoleChangeTarget = { _id: ObjectId; email: string; role: Role };

/**
 * The one place a role is written, whether an admin changed it directly or a
 * second admin approved a request (AdminApprovalsService, ASVS 2.3.5). Both
 * get the same checks: the role must not have moved since it was read, the
 * last admin is never demoted, and the account is signed out everywhere so
 * the old role in its session token stops working.
 */
@Injectable()
export class RoleChangesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly revocation: SessionRevocationService,
  ) {}

  /** Admins other than `id`; `id` need not be an admin (or exist). */
  otherAdmins(id: ObjectId | null) {
    return this.db.users.countDocuments({ role: "admin", ...(id && { _id: { $ne: id } }) });
  }

  /**
   * Writes `role` (and `name`, when given) to the account, provided its role
   * is still `current.role`. The last-admin check runs before and again after
   * the write, so two admins demoted at the same moment can't both go through.
   * `detailSuffix` is appended to the audit entry, e.g. who asked and approved.
   */
  async apply(
    current: RoleChangeTarget,
    role: Role,
    actor: string,
    options: { name?: string; detailSuffix?: string; session?: ClientSession; notify?: boolean } = {},
  ) {
    // The role, the sign-out and the audit entry land together or not at all
    // (ASVS 2.3.3); a caller that already runs a transaction passes its session.
    const run = async (session: ClientSession | undefined) => {
      const demotesAdmin = current.role === "admin" && role !== "admin";
      // In a transaction each demotion reads a snapshot, so two at once could
      // each see the other admin still there and both commit. Writing the same
      // document makes them collide; the retry then sees the first one's change.
      if (demotesAdmin && session) {
        await this.db.locks.updateOne({ _id: "admin-demotion" }, { $set: { at: new Date() } }, { upsert: true, session });
      }
      if (demotesAdmin && (await this.db.users.countDocuments({ role: "admin", _id: { $ne: current._id } }, { session })) === 0) {
        throw new ConflictException(LAST_ADMIN);
      }

      const result = await this.db.users.findOneAndUpdate(
        { _id: current._id, role: current.role },
        { $set: { role, ...(options.name !== undefined && { name: options.name }) } },
        { returnDocument: "after", projection: DIRECTORY_FIELDS, session },
      );
      // The role moved under us between the read and the write.
      if (!result) throw new ConflictException(CHANGED_MEANWHILE);

      // Without a transaction (a single-server database), the write is undone by hand.
      if (demotesAdmin && (await this.db.users.countDocuments({ role: "admin" }, { session })) === 0) {
        await this.db.users.updateOne({ _id: current._id }, { $set: { role: "admin" } }, { session });
        throw new ConflictException(LAST_ADMIN);
      }

      await this.revocation.revoke(current._id.toString(), session);
      await this.audit.record(
        actor,
        "เปลี่ยนบทบาทผู้ใช้",
        `${current.email}: ${ROLE_LABELS[current.role]} → ${ROLE_LABELS[role]}${options.detailSuffix ?? ""}`,
        session,
      );
      return result;
    };

    const result = options.session ? await run(options.session) : await this.db.transaction(run);
    if (!options.session && options.notify !== false) await this.notifyRoleChanged(current._id, role);
    return result;
  }

  /** After the change has committed; a caller with its own transaction calls this once it has. */
  notifyRoleChanged(userId: ObjectId, role: Role) {
    return this.notifications.create(
      userId,
      "system",
      "บทบาทของบัญชีคุณเปลี่ยนแล้ว",
      `ผู้ดูแลระบบเปลี่ยนบทบาทของคุณเป็น${ROLE_LABELS[role]} กรุณาเข้าสู่ระบบอีกครั้ง`,
    );
  }
}
