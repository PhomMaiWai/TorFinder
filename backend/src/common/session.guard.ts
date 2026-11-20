import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

import { logSecurityEvent } from "./security-log";
import { SessionRevocationService } from "./session-revocation.service";
import { SessionPayload, verifySessionToken } from "./token";

/** One `access.denied` line per refused request (ASVS 16.3.2); the path never carries its query string. */
export function logDenied(request: Request, reason: string, userId?: string, role?: string): void {
  logSecurityEvent("access.denied", {
    outcome: "failure",
    reason,
    userId,
    role,
    ip: request.ip,
    method: request.method,
    path: request.path,
  });
}

/**
 * One `access.granted` line per admitted request to a protected route (ASVS
 * 16.3.2 at Level 3: every authorization decision, allowed ones too, so access
 * to sensitive data is on record). Who, with which role, which method and
 * path; never the query string or any of the data.
 */
export function logGranted(request: Request, guard: string, userId: string, role: string): void {
  logSecurityEvent("access.granted", {
    outcome: "success",
    reason: guard,
    userId,
    role,
    ip: request.ip,
    method: request.method,
    path: request.path,
  });
}

/** The route's own view of who is calling. */
export type AuthenticatedRequest = Request & { session: SessionPayload };

/**
 * Any signed-in account, admin or organization. Routes that serve a caller
 * their *own* data use this: the identity comes from the token rather than a
 * body field, so one account cannot ask for another's.
 *
 * `revocation` is `@Optional()`: through real NestJS DI it's always provided
 * (DatabaseModule is global), so live requests always get the revocation
 * check. role-guards.test.mjs instantiates guards directly with `new
 * SessionGuard()`, bypassing DI entirely, by design — it only exercises the
 * signature/role logic against freshly minted tokens, so skipping the
 * DB-backed revocation check there is correct, not a gap.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Optional() private readonly revocation?: SessionRevocationService) {}

  /** See RoleGuard.canActivate for why this isn't declared `async`. */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    const session = scheme === "Bearer" ? verifySessionToken(token) : null;

    if (!session) {
      logDenied(request, token ? "invalid_token" : "no_token");
      throw new UnauthorizedException("กรุณาเข้าสู่ระบบ");
    }

    if (!this.revocation) {
      request.session = session;
      logGranted(request, "session", session.sub, session.role);
      return true;
    }

    // Signature and exp alone aren't enough: a token can be well-formed and
    // unexpired yet still revoked (logout, password reset, suspension) — see
    // SessionRevocationService.
    return this.revocation.isValid(session.sub, session.iat).then((valid) => {
      if (!valid) {
        logDenied(request, "revoked_token", session.sub, session.role);
        throw new UnauthorizedException("กรุณาเข้าสู่ระบบ");
      }
      request.session = session;
      logGranted(request, "session", session.sub, session.role);
      return true;
    });
  }
}
