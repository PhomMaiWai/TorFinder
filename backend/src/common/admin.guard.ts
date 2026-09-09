import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Request } from "express";

import { verifySessionToken } from "./token";

/**
 * Approving an account is privileged, so the caller must present the session
 * token of a logged-in admin — the frontend forwards it from its session cookie.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    const session = scheme === "Bearer" ? verifySessionToken(token) : null;

    if (session?.role !== "admin") {
      throw new ForbiddenException("ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ");
    }
    return true;
  }
}
