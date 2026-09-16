import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

import { AuthenticatedRequest } from "./session.guard";
import { verifySessionToken } from "./token";

/**
 * Approving an account is privileged, so the caller must present the session
 * token of a logged-in admin — the frontend forwards it from its session cookie.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    const session = scheme === "Bearer" ? verifySessionToken(token) : null;

    if (session?.role !== "admin") {
      throw new ForbiddenException("ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ");
    }
    // Same attachment SessionGuard does — lets a handler attribute the action
    // to this admin (see AuditService) without re-verifying the token itself.
    request.session = session;
    return true;
  }
}
