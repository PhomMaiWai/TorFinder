import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Optional } from "@nestjs/common";

import { env } from "../config/env";
import { Role, isStaffRole } from "./roles";
import { SessionRevocationService } from "./session-revocation.service";
import { AuthenticatedRequest, logDenied } from "./session.guard";
import { verifySessionToken } from "./token";

/**
 * A route open to exactly the roles a subclass names. The caller presents the
 * session token in the Authorization header — the frontend forwards it from
 * its session cookie. No token, a forged one, the wrong role, and a revoked
 * token are all refused the same way, so a response never says which of them
 * it was.
 *
 * A guard admits one role, not "admin or better": an admin is not implicitly
 * an owner or an auditor, and neither of those can reach an admin route. A
 * route that needs several roles takes a subclass that lists them.
 *
 * `@Injectable()` here (not just on the concrete subclasses) is what lets
 * Nest's DI resolve the constructor below for OwnerGuard/OrgGuard/AdminGuard/
 * AuditorGuard, none of which declare their own constructor.
 *
 * `revocation` is `@Optional()` for the same reason as in SessionGuard:
 * role-guards.test.mjs does `new AdminGuard()` directly, with no DI container
 * at all, by design (see that file's own header comment) — it only checks
 * role/signature logic, so the DB-backed revocation check correctly has
 * nothing to attach to there and is skipped rather than crashing.
 */
@Injectable()
export abstract class RoleGuard implements CanActivate {
  protected abstract readonly roles: readonly Role[];
  /** What the refused caller is told, in the screen's own language. */
  protected abstract readonly refusal: string;

  constructor(@Optional() private readonly revocation?: SessionRevocationService) {}

  /**
   * Deliberately not `async`: role-guards.test.mjs calls this synchronously
   * (`new AdminGuard().canActivate(context)`, no `await`) and expects a plain
   * boolean back, or a synchronous throw — `async` would wrap both in a
   * Promise and silently break that. Returning a bare `boolean` when there's
   * no revocation service to check, and only a `Promise<boolean>` when there
   * is one, keeps both callers correct: NestJS's real request pipeline awaits
   * either shape fine.
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    const session = scheme === "Bearer" ? verifySessionToken(token) : null;

    if (!session || !this.roles.includes(session.role)) {
      logDenied(request, !session ? (token ? "invalid_token" : "no_token") : "wrong_role", session?.sub, session?.role);
      throw new ForbiddenException(this.refusal);
    }

    // While passkeys are required, a staff session that didn't use one can
    // only add one (on SessionGuard routes) — not reach the staff console
    // (ASVS 6.3.3). The code tells the frontend where to send them.
    if (env.passkeys.required && isStaffRole(session.role) && !session.amr?.includes("passkey")) {
      logDenied(request, "passkey_setup_required", session.sub, session.role);
      throw new ForbiddenException({
        statusCode: 403,
        code: "passkey-setup-required",
        message: "บัญชีเจ้าหน้าที่ต้องเพิ่มพาสคีย์ก่อนใช้งาน กรุณาไปที่หน้าบัญชีของฉัน",
      });
    }

    if (!this.revocation) {
      // Same attachment as below — lets a handler attribute the action to
      // this caller (see AuditService) without re-verifying the token itself.
      request.session = session;
      return true;
    }

    // Same revocation check as SessionGuard — see SessionRevocationService.
    // Role-guarded routes don't go through SessionGuard at all, so this has
    // to be enforced here independently, not inherited from it.
    return this.revocation.isValid(session.sub, session.iat).then((valid) => {
      if (!valid) {
        logDenied(request, "revoked_token", session.sub, session.role);
        throw new ForbiddenException(this.refusal);
      }
      request.session = session;
      return true;
    });
  }
}
