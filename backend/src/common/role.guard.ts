import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Optional, UnauthorizedException } from "@nestjs/common";

import { Role } from "./roles";
import { SessionRevocationService } from "./session-revocation.service";
import { AuthenticatedRequest, assertPasskeySetupDone, logDenied, logGranted } from "./session.guard";
import { bearerToken, verifySessionToken } from "./token";

/**
 * A route open to exactly the roles a subclass names. The caller presents the
 * session token in the Authorization header — the frontend forwards it from
 * its session cookie. No token, a forged, expired or revoked one is 401 (sign
 * in again), the same answer SessionGuard gives; a valid session with the
 * wrong role is 403. The body is the same refusal text either way, and the
 * caller only learns what it already knows: whether its own token is valid.
 *
 * A guard admits one role, not "admin or better": an admin is not implicitly
 * an owner, and an owner can't reach an admin route. A
 * route that needs several roles takes a subclass that lists them.
 *
 * `@Injectable()` here (not just on the concrete subclasses) is what lets
 * Nest's DI resolve the constructor below for OrgGuard/AdminGuard,
 * none of which declare their own constructor.
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
    const token = bearerToken(request.headers.authorization);
    const session = verifySessionToken(token);

    if (!session) {
      logDenied(request, request.headers.authorization ? "invalid_token" : "no_token");
      throw new UnauthorizedException(this.refusal);
    }
    if (!this.roles.includes(session.role)) {
      logDenied(request, "wrong_role", session.sub, session.role);
      throw new ForbiddenException(this.refusal);
    }

    // While passkeys are required for this kind of account, a session that
    // didn't use one can only add one (on the /auth routes), not reach its
    // console or data (ASVS 6.3.3). The code tells the frontend where to send them.
    assertPasskeySetupDone(request, session);

    if (!this.revocation) {
      // Same attachment as below — lets a handler attribute the action to
      // this caller (see AuditService) without re-verifying the token itself.
      request.session = session;
      logGranted(request, `role:${this.roles.join("|")}`, session.sub, session.role);
      return true;
    }

    // Same revocation check as SessionGuard — see SessionRevocationService.
    // Role-guarded routes don't go through SessionGuard at all, so this has
    // to be enforced here independently, not inherited from it.
    return this.revocation.isValid(session.sub, session.iat, session.sid).then((valid) => {
      if (!valid) {
        logDenied(request, "revoked_token", session.sub, session.role);
        throw new UnauthorizedException(this.refusal);
      }
      request.session = session;
      logGranted(request, `role:${this.roles.join("|")}`, session.sub, session.role);
      return true;
    });
  }
}
