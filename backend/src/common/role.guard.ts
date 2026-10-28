import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

import { Role } from "./roles";
import { SessionRevocationService } from "./session-revocation.service";
import { AuthenticatedRequest } from "./session.guard";
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
 */
@Injectable()
export abstract class RoleGuard implements CanActivate {
  protected abstract readonly roles: readonly Role[];
  /** What the refused caller is told, in the screen's own language. */
  protected abstract readonly refusal: string;

  constructor(private readonly revocation: SessionRevocationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    const session = scheme === "Bearer" ? verifySessionToken(token) : null;

    // Same revocation check as SessionGuard — see SessionRevocationService.
    // Role-guarded routes don't go through SessionGuard at all, so this has
    // to be enforced here independently, not inherited from it.
    if (
      !session ||
      !this.roles.includes(session.role) ||
      !(await this.revocation.isValid(session.sub, session.iat))
    ) {
      throw new ForbiddenException(this.refusal);
    }
    // Same attachment SessionGuard does — lets a handler attribute the action
    // to this caller (see AuditService) without re-verifying the token itself.
    request.session = session;
    return true;
  }
}
