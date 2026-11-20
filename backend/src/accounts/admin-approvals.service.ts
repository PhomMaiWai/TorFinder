import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MongoServerError, ObjectId } from "mongodb";

import { AuditService } from "../audit/audit.service";
import { Role } from "../common/roles";
import { logSecurityEvent } from "../common/security-log";
import { SessionPayload } from "../common/token";
import { env } from "../config/env";
import { AdminApprovalDoc, DatabaseService } from "../database/database.service";
import { NotificationsService } from "../notifications/notifications.service";
import { DIRECTORY_FIELDS, ROLE_LABELS, RoleChangeTarget, RoleChangesService } from "./role-changes.service";

const NOT_FOUND = "ไม่พบคำขอนี้ หรือคำขอหมดอายุแล้ว";
const OWN_REQUEST = "อนุมัติคำขอของตัวเองไม่ได้ ต้องให้ผู้ดูแลระบบคนอื่นเป็นผู้อนุมัติ";
const ALREADY_OPEN = "บัญชีนี้มีคำขอเปลี่ยนบทบาทผู้ดูแลระบบที่รออนุมัติอยู่แล้ว";
const ROLE_MOVED = "บทบาทของบัญชีนี้เปลี่ยนไปหลังจากส่งคำขอ คำขอนี้จึงใช้ไม่ได้แล้ว";
const REQUESTER_GONE = "ผู้ส่งคำขอไม่ได้เป็นผู้ดูแลระบบแล้ว คำขอนี้จึงถูกยกเลิก";

/** An open request as the Manage Users page shows it. */
export type PendingAdminChange = {
  id: string;
  targetId: string;
  targetEmail: string;
  targetName: string;
  fromRole: Role;
  toRole: Role;
  requestedBy: string;
  /** The viewer asked for it: they can cancel, not approve. */
  mine: boolean;
  createdAt: string;
  expiresAt: string;
};

/** Grants or removes the admin role: what has to be approved by a second admin. */
export const touchesAdmin = (from: Role, to: Role) => from !== to && (from === "admin" || to === "admin");

const describe = (doc: Pick<AdminApprovalDoc, "targetEmail" | "fromRole" | "toRole">) =>
  `${doc.targetEmail}: ${ROLE_LABELS[doc.fromRole]} → ${ROLE_LABELS[doc.toRole]}`;

const toObjectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

/**
 * ASVS 2.3.5 (and a layer for 8.4.2): giving someone the admin role, or taking
 * it away, needs two admins. The first one's edit only files a request; a
 * different admin approves it, behind the same passkey step-up as every other
 * account decision. The requester can cancel; any other admin can reject.
 * A request lapses after env.adminApproval.expiryHours (TTL index), so an
 * old one can't be approved long after anyone remembers why it was made.
 *
 * Each step is written to the audit log and the security log. One stolen
 * admin session or passkey is then no longer enough to make a new admin or
 * push the real ones out.
 */
@Injectable()
export class AdminApprovalsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly roles: RoleChangesService,
  ) {}

  /**
   * Whether `actor` changing an account between `from` and `to` has to wait.
   * The one exception: the very first extra admin. With no other admin there
   * is no one to approve, and a lone admin already holds every power this
   * control protects, so the change is made at once (and logged as such).
   */
  async needsApproval(from: Role, to: Role, actor: SessionPayload): Promise<boolean> {
    if (!touchesAdmin(from, to)) return false;
    return (await this.roles.otherAdmins(toObjectId(actor.sub))) > 0;
  }

  /** Files the request and tells every other admin there is one to look at. */
  async request(target: RoleChangeTarget & { name: string }, toRole: Role, actor: SessionPayload, ip?: string) {
    const requesterId = toObjectId(actor.sub);
    if (!requesterId) throw new ForbiddenException();
    const now = new Date();
    const doc: AdminApprovalDoc = {
      targetId: target._id,
      targetEmail: target.email,
      targetName: target.name,
      fromRole: target.role,
      toRole,
      requestedBy: { id: requesterId, email: actor.email },
      createdAt: now,
      expiresAt: new Date(now.getTime() + env.adminApproval.expiryHours * 3_600_000),
    };

    // MongoDB's TTL sweep runs about once a minute, so a lapsed request can
    // linger briefly and would still trip the one-per-account unique index.
    await this.db.adminApprovals.deleteOne({ targetId: target._id, expiresAt: { $lte: now } });
    let insertedId: ObjectId;
    try {
      ({ insertedId } = await this.db.adminApprovals.insertOne(doc));
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) throw new ConflictException(ALREADY_OPEN);
      throw error;
    }

    logSecurityEvent("admin.approval.request", {
      outcome: "success",
      userId: target._id.toString(),
      email: target.email,
      ip,
      role: toRole,
      reason: `by_${actor.sub}`,
    });

    const others = await this.db.users
      .find({ role: "admin", _id: { $ne: requesterId } }, { projection: { _id: 1 } })
      .toArray();
    await Promise.all([
      this.audit.record(actor.email, "ขอเปลี่ยนบทบาทผู้ดูแลระบบ (รออนุมัติ)", describe(doc)),
      ...others.map(({ _id }) =>
        this.notifications.create(
          _id,
          "system",
          "มีคำขอเปลี่ยนบทบาทผู้ดูแลระบบรออนุมัติ",
          `${actor.email} ขอเปลี่ยน ${target.name} (${target.email}) จาก${ROLE_LABELS[target.role]}เป็น${ROLE_LABELS[toRole]} กรุณาตรวจสอบที่หน้าจัดการผู้ใช้`,
        ),
      ),
    ]);

    return this.present({ ...doc, _id: insertedId }, actor);
  }

  async list(actor: SessionPayload): Promise<PendingAdminChange[]> {
    const docs = await this.db.adminApprovals
      .find({ expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .toArray();
    return docs.map((doc) => this.present(doc, actor));
  }

  /**
   * A second admin approves. The request is claimed (deleted) atomically
   * first, so two approvers clicking at once can't apply it twice. It is then
   * refused, and stays deleted, if its requester is no longer an admin or the
   * account's role has moved since it was asked.
   */
  async approve(id: string, actor: SessionPayload, ip?: string) {
    const _id = toObjectId(id);
    const approverId = toObjectId(actor.sub);
    if (!_id) throw new NotFoundException(NOT_FOUND);

    const pending = await this.db.adminApprovals.findOne({ _id, expiresAt: { $gt: new Date() } });
    if (!pending) throw new NotFoundException(NOT_FOUND);
    if ((approverId && pending.requestedBy.id.equals(approverId)) || pending.requestedBy.email === actor.email) {
      logSecurityEvent("admin.approval.approve", {
        outcome: "failure",
        userId: pending.targetId.toString(),
        ip,
        reason: "own_request",
      });
      throw new ForbiddenException(OWN_REQUEST);
    }

    const claimed = await this.db.adminApprovals.findOneAndDelete({ _id, expiresAt: { $gt: new Date() } });
    if (!claimed) throw new NotFoundException(NOT_FOUND);

    const fail = async (message: string, reason: string) => {
      logSecurityEvent("admin.approval.approve", { outcome: "failure", userId: claimed.targetId.toString(), ip, reason });
      await this.audit.record(actor.email, "คำขอเปลี่ยนบทบาทผู้ดูแลระบบใช้ไม่ได้", `${describe(claimed)} — ${message}`);
      return new ConflictException(message);
    };

    if ((await this.db.users.countDocuments({ _id: claimed.requestedBy.id, role: "admin" })) === 0) {
      throw await fail(REQUESTER_GONE, "requester_not_admin");
    }
    const current = await this.db.users.findOne({ _id: claimed.targetId }, { projection: DIRECTORY_FIELDS });
    if (!current || current.role !== claimed.fromRole) throw await fail(ROLE_MOVED, "role_changed");

    const result = await this.roles.apply(current, claimed.toRole, actor.email, {
      detailSuffix: ` (ขอโดย ${claimed.requestedBy.email}, อนุมัติโดย ${actor.email})`,
    });

    logSecurityEvent("admin.approval.approve", {
      outcome: "success",
      userId: claimed.targetId.toString(),
      email: claimed.targetEmail,
      ip,
      role: claimed.toRole,
      reason: `by_${actor.sub}`,
    });
    await Promise.all([
      this.audit.record(actor.email, "อนุมัติคำขอเปลี่ยนบทบาทผู้ดูแลระบบ", `${describe(claimed)} (ขอโดย ${claimed.requestedBy.email})`),
      this.notifications.create(
        claimed.requestedBy.id,
        "system",
        "คำขอเปลี่ยนบทบาทผู้ดูแลระบบได้รับการอนุมัติ",
        `${actor.email} อนุมัติการเปลี่ยน ${claimed.targetName} (${claimed.targetEmail}) เป็น${ROLE_LABELS[claimed.toRole]}แล้ว`,
      ),
    ]);

    const { _id: userId, ...rest } = result;
    return { id: userId.toString(), ...rest };
  }

  /** The requester cancels, or any other admin rejects; either way nothing changes. */
  async reject(id: string, actor: SessionPayload, ip?: string) {
    const _id = toObjectId(id);
    if (!_id) throw new NotFoundException(NOT_FOUND);
    const claimed = await this.db.adminApprovals.findOneAndDelete({ _id, expiresAt: { $gt: new Date() } });
    if (!claimed) throw new NotFoundException(NOT_FOUND);

    const own = claimed.requestedBy.email === actor.email;
    logSecurityEvent("admin.approval.reject", {
      outcome: "success",
      userId: claimed.targetId.toString(),
      email: claimed.targetEmail,
      ip,
      reason: own ? "cancelled" : `by_${actor.sub}`,
    });
    await Promise.all([
      this.audit.record(
        actor.email,
        own ? "ยกเลิกคำขอเปลี่ยนบทบาทผู้ดูแลระบบ" : "ปฏิเสธคำขอเปลี่ยนบทบาทผู้ดูแลระบบ",
        `${describe(claimed)} (ขอโดย ${claimed.requestedBy.email})`,
      ),
      !own &&
        this.notifications.create(
          claimed.requestedBy.id,
          "system",
          "คำขอเปลี่ยนบทบาทผู้ดูแลระบบถูกปฏิเสธ",
          `${actor.email} ปฏิเสธการเปลี่ยน ${claimed.targetName} (${claimed.targetEmail}) เป็น${ROLE_LABELS[claimed.toRole]}`,
        ),
    ]);
    return { ok: true as const };
  }

  private present(doc: AdminApprovalDoc & { _id: ObjectId }, actor: SessionPayload): PendingAdminChange {
    return {
      id: doc._id.toString(),
      targetId: doc.targetId.toString(),
      targetEmail: doc.targetEmail,
      targetName: doc.targetName,
      fromRole: doc.fromRole,
      toRole: doc.toRole,
      requestedBy: doc.requestedBy.email,
      mine: doc.requestedBy.email === actor.email,
      createdAt: doc.createdAt.toISOString(),
      expiresAt: doc.expiresAt.toISOString(),
    };
  }
}
