import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";

import { SessionPayload, verifySessionToken } from "./token";

/** The route's own view of who is calling. */
export type AuthenticatedRequest = Request & { session: SessionPayload };

/**
 * Any signed-in account, admin or organization. Routes that serve a caller
 * their *own* data use this: the identity comes from the token rather than a
 * body field, so one account cannot ask for another's.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    const session = scheme === "Bearer" ? verifySessionToken(token) : null;

    if (!session) throw new UnauthorizedException("กรุณาเข้าสู่ระบบ");

    request.session = session;
    return true;
  }
}
