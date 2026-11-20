import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId } from "mongodb";

import { AuditService } from "../audit/audit.service";
import { AccountLinksService } from "../auth/account-links.service";
import { PasskeysService } from "../auth/passkeys.service";
import { logSecurityEvent } from "../common/security-log";
import { SessionRevocationService } from "../common/session-revocation.service";
import { SessionPayload } from "../common/token";
import { Role } from "../common/roles";
import { ACCOUNT_STATUSES, AccountStatus, DatabaseService, UserDoc } from "../database/database.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AdminApprovalsService, PendingAdminChange } from "./admin-approvals.service";
import { ReviewAccountDto } from "./dto/review-account.dto";
import { EDITABLE_ROLES, UpdateUserDto } from "./dto/update-user.dto";
import { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";
import {
  CHANGED_MEANWHILE,
  DIRECTORY_FIELDS,
  LAST_ADMIN,
  OWN_ACCOUNT_FIELDS,
  REVIEW_FIELDS,
  RoleChangesService,
} from "./role-changes.service";

/**
 * Who an admin may suspend: self-serve accounts. Staff roles (admin, owner,
 * auditor) are seeded and managed outside the app, so they stay untouchable.
 */
const SUSPENDABLE_ROLES = ["org", "viewer"] as const;

@Injectable()
export class AccountsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly revocation: SessionRevocationService,
    private readonly passkeys: PasskeysService,
    private readonly links: AccountLinksService,
    private readonly roles: RoleChangesService,
    private readonly approvals: AdminApprovalsService,
  ) {}

  async findAll(status?: AccountStatus) {
    const filter: Filter<UserDoc> = { role: "org" };
    // The DTO already allows only these three (@IsIn), but the query doesn't
    // rely on that: the value used is the constant from the list, never the
    // request's own, so no operator object can reach MongoDB (NoSQL injection).
    const known = ACCOUNT_STATUSES.find((value) => value === status);
    if (known) filter.status = known;

    const docs = await this.db.users
      .find(filter, { projection: REVIEW_FIELDS })
      .sort({ createdAt: -1 })
      .toArray();

    return docs.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
  }

  /**
   * Every account — admin and org alike — for the admin dashboard's user
   * directory. Unlike findAll(), never filtered to organizations: that's
   * what the signup-approval queue needs, this is "who exists at all".
   */
  async findAllUsers() {
    const docs = await this.db.users.find({}, { projection: DIRECTORY_FIELDS }).sort({ createdAt: -1 }).toArray();
    return docs.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
  }

  /**
   * Orthogonal to review(): blocks (or unblocks) sign-in on an account
   * without touching its approval status — see AuthService.issueSession,
   * which is what actually enforces this.
   */
  /** See PasskeysService.resetFor; recorded in the audit log like the other account decisions. */
  async resetPasskeys(id: string, actor: SessionPayload, ip?: string) {
    const user = await this.passkeys.resetFor(id, actor, ip);
    await this.audit.record(actor.email, "ล้างพาสคีย์ของบัญชี", `${user.name} (${user.email})`);
    return { ok: true as const };
  }

  /**
   * ASVS 6.4.6: an admin starts a reset without choosing the password. The
   * owner gets the same single-use, one-hour link as "forgot password"; their
   * current password and sessions stay until they use it. Viewers sign in only
   * with Google and have no password to reset; a suspended account must be
   * reactivated first, as with "forgot password".
   */
  async sendPasswordReset(id: string, actor: SessionPayload, ip?: string) {
    const user = ObjectId.isValid(id)
      ? await this.db.users.findOne({ _id: new ObjectId(id) }, { projection: { email: 1, name: 1, role: 1, suspended: 1 } })
      : null;
    if (!user) throw new NotFoundException("ไม่พบบัญชีนี้");
    if (user.role === "viewer") throw new BadRequestException("บัญชีประชาชนทั่วไปเข้าสู่ระบบด้วย Google จึงไม่มีรหัสผ่านให้ตั้งใหม่");
    if (user.suspended) throw new BadRequestException("บัญชีนี้ถูกระงับอยู่ กรุณาเปิดใช้งานก่อนส่งลิงก์ตั้งรหัสผ่าน");

    await this.links.send(user, "password-reset", {
      intro: "ผู้ดูแลระบบ TOR Finder ส่งลิงก์ตั้งรหัสผ่านใหม่ให้บัญชีนี้ กดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ด้วยตัวเอง ผู้ดูแลระบบไม่เห็นและไม่ได้กำหนดรหัสผ่านของคุณ",
    });
    logSecurityEvent("auth.password.reset.admin", {
      outcome: "success",
      userId: id,
      email: user.email,
      ip,
      reason: `by_${actor.sub}`,
    });
    await this.audit.record(actor.email, "ส่งลิงก์ตั้งรหัสผ่านใหม่", `${user.name} (${user.email})`);
    return { ok: true as const };
  }

  async setSuspended(id: string, suspended: boolean, actor: string) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบบัญชีนี้");

    const result = await this.db.users.findOneAndUpdate(
      { _id: new ObjectId(id), role: { $in: [...SUSPENDABLE_ROLES] } },
      { $set: { suspended } },
      { returnDocument: "after", projection: DIRECTORY_FIELDS },
    );
    if (!result) throw new NotFoundException("ไม่พบบัญชีนี้");

    // Otherwise a token issued before the suspension keeps working for the
    // rest of its 7-day lifetime regardless of this decision (ASVS 7.4.2).
    if (suspended) await this.revocation.revoke(id);

    const companyName = result.company?.companyName ?? result.name;
    await Promise.all([
      this.notifications.create(
        result._id,
        "system",
        suspended ? "บัญชีของคุณถูกระงับการใช้งาน" : "บัญชีของคุณกลับมาใช้งานได้แล้ว",
        suspended
          ? "ผู้ดูแลระบบระงับการใช้งานบัญชีนี้ชั่วคราว กรุณาติดต่อผู้ดูแลระบบหากมีข้อสงสัย"
          : "ผู้ดูแลระบบเปิดใช้งานบัญชีนี้อีกครั้ง เข้าใช้งานได้ทันที",
      ),
      this.audit.record(
        actor,
        result.role === "viewer"
          ? suspended
            ? "ระงับบัญชีประชาชนทั่วไป"
            : "เปิดใช้งานบัญชีประชาชนทั่วไปอีกครั้ง"
          : suspended
            ? "ระงับบัญชีบริษัท"
            : "เปิดใช้งานบัญชีบริษัทอีกครั้ง",
        companyName,
      ),
    ]);

    const { _id, ...rest } = result;
    return { id: _id.toString(), ...rest };
  }

  /**
   * An admin renames an account or moves it between roles. Each field that
   * actually changes gets its own audit entry. A role lives in the session
   * token, so changing it signs the account out everywhere (RoleChangesService).
   *
   * Granting or removing the admin role isn't applied here: it files a request
   * that a second admin must approve (AdminApprovalsService, ASVS 2.3.5), and
   * the answer carries `pendingApproval`. A rename in the same edit still
   * applies at once. The last admin can't be demoted, asked or not.
   */
  async updateUser(
    id: string,
    { name, role }: UpdateUserDto,
    actor: SessionPayload,
    ip?: string,
  ): Promise<Record<string, unknown> & { id: string; pendingApproval?: PendingAdminChange }> {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบบัญชีนี้");
    const _id = new ObjectId(id);

    const current = await this.db.users.findOne({ _id }, { projection: DIRECTORY_FIELDS });
    if (!current) throw new NotFoundException("ไม่พบบัญชีนี้");

    const roleChanges = role !== undefined && role !== current.role;
    const nameChanges = name !== undefined && name !== current.name;
    if (roleChanges && !(EDITABLE_ROLES as readonly Role[]).includes(current.role)) {
      throw new BadRequestException("เปลี่ยนบทบาทของบัญชีบริษัทไม่ได้");
    }
    if (roleChanges && current.role === "admin" && (await this.roles.otherAdmins(_id)) === 0) {
      throw new ConflictException(LAST_ADMIN);
    }

    if (!roleChanges && !nameChanges) {
      const { _id: unchanged, ...rest } = current;
      return { id: unchanged.toString(), ...rest };
    }

    const waits = roleChanges && (await this.approvals.needsApproval(current.role, role, actor));
    // Filed before anything is written, so a second open request (409) changes nothing.
    const pendingApproval = waits ? await this.approvals.request(current, role, actor, ip) : undefined;

    let result: UserDoc & { _id: ObjectId };
    if (roleChanges && !waits) {
      result = await this.roles.apply(current, role, actor.email, { ...(nameChanges && { name }) });
    } else if (!nameChanges) {
      result = current;
    } else {
      const renamed = await this.db.users.findOneAndUpdate(
        { _id, role: current.role },
        { $set: { name } },
        { returnDocument: "after", projection: DIRECTORY_FIELDS },
      );
      if (!renamed) {
        if (pendingApproval) await this.db.adminApprovals.deleteOne({ _id: new ObjectId(pendingApproval.id) });
        throw new ConflictException(CHANGED_MEANWHILE);
      }
      result = renamed;
    }

    if (nameChanges) await this.audit.record(actor.email, "แก้ไขชื่อผู้ใช้", `${current.email}: ${current.name} → ${name}`);

    const { _id: updated, ...rest } = result;
    return { id: updated.toString(), ...rest, ...(pendingApproval && { pendingApproval }) };
  }

  async review(id: string, { status }: ReviewAccountDto, actor: string) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบบัญชีนี้");

    const result = await this.db.users.findOneAndUpdate(
      { _id: new ObjectId(id), role: "org" },
      { $set: { status, reviewedAt: new Date() } },
      { returnDocument: "after", projection: REVIEW_FIELDS },
    );
    if (!result) throw new NotFoundException("ไม่พบบัญชีนี้");

    // A company whose approval is taken back loses its access now, not when
    // its 7-day session runs out: the guards trust the session, so it is
    // revoked here (ASVS 8.3.2).
    if (status !== "approved") await this.revocation.revoke(id);

    const companyName = result.company?.companyName ?? result.name;
    await Promise.all([
      this.notifyReviewDecision(result._id, status, companyName),
      this.audit.record(
        actor,
        status === "approved" ? "อนุมัติบัญชีบริษัท" : "ปฏิเสธบัญชีบริษัท",
        companyName,
      ),
    ]);

    const { _id, ...rest } = result;
    return { id: _id.toString(), ...rest };
  }

  private async notifyReviewDecision(
    userId: ObjectId,
    status: Exclude<AccountStatus, "pending">,
    companyName: string,
  ) {
    if (status === "approved") {
      await this.notifications.create(
        userId,
        "approval",
        "บัญชีของคุณได้รับการอนุมัติแล้ว",
        `ผู้ดูแลระบบอนุมัติบัญชี ${companyName} เรียบร้อยแล้ว เข้าใช้งานได้ทันที`,
      );
      return;
    }
    await this.notifications.create(
      userId,
      "approval",
      "บัญชีของคุณไม่ผ่านการอนุมัติ",
      "บัญชีของคุณไม่ผ่านการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ",
    );
  }

  async findOwn(userId: string) {
    if (!ObjectId.isValid(userId)) throw new NotFoundException("ไม่พบบัญชีนี้");

    const doc = await this.db.users.findOne({ _id: new ObjectId(userId) }, { projection: OWN_ACCOUNT_FIELDS });
    if (!doc) throw new NotFoundException("ไม่พบบัญชีนี้");

    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest };
  }

  /**
   * companyName/taxId are normally fixed at signup — but a Google sign-up
   * never collects them (see AuthService.googleAuth), so they start blank on
   * those accounts. This allows a one-time fill for whichever of the two is
   * still blank, then locks it exactly like every other signup path.
   */
  private static readonly LOCKED_ONCE_SET = ["companyName", "taxId"] as const;

  async updateOwn(userId: string, dto: UpdateCompanyProfileDto) {
    if (!ObjectId.isValid(userId)) throw new NotFoundException("ไม่พบบัญชีนี้");

    const current = await this.db.users.findOne(
      { _id: new ObjectId(userId), role: "org" },
      { projection: { company: 1 } },
    );
    if (!current) throw new NotFoundException("ไม่พบบัญชีนี้");

    // ASVS 2.2.3: the preferred budget range must make sense as a pair, checked
    // against the stored value when only one end is being changed.
    const budgetMin = dto.preferredBudgetMin ?? current.company?.preferredBudgetMin;
    const budgetMax = dto.preferredBudgetMax ?? current.company?.preferredBudgetMax;
    if (budgetMin !== undefined && budgetMax !== undefined && budgetMin > budgetMax) {
      throw new BadRequestException("งบประมาณขั้นต่ำต้องไม่มากกว่างบประมาณสูงสุด");
    }

    const filtered = { ...dto };
    for (const field of AccountsService.LOCKED_ONCE_SET) {
      if (current.company?.[field]) delete filtered[field];
    }

    const updates = Object.fromEntries(
      Object.entries(filtered)
        .filter(([, v]) => v !== undefined)
        .map(([key, v]) => [`company.${key}`, v]),
    );

    const result =
      Object.keys(updates).length > 0
        ? await this.db.users.findOneAndUpdate(
            { _id: new ObjectId(userId), role: "org" },
            { $set: updates },
            { returnDocument: "after", projection: OWN_ACCOUNT_FIELDS },
          )
        : await this.db.users.findOne({ _id: new ObjectId(userId), role: "org" }, { projection: OWN_ACCOUNT_FIELDS });
    if (!result) throw new NotFoundException("ไม่พบบัญชีนี้");

    const { _id, ...rest } = result;
    return { id: _id.toString(), ...rest };
  }
}
