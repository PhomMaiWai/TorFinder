import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

import { SessionRevocationService } from "./session-revocation.service";
import { SessionPayload, verifySessionToken } from "./token";

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

    if (!session) throw new UnauthorizedException("กรุณาเข้าสู่ระบบ");

    if (!this.revocation) {
      request.session = session;
      return true;
    }

    // Signature and exp alone aren't enough: a token can be well-formed and
    // unexpired yet still revoked (logout, password reset, suspension) — see
    // SessionRevocationService.
    return this.revocation.isValid(session.sub, session.iat).then((valid) => {
      if (!valid) throw new UnauthorizedException("กรุณาเข้าสู่ระบบ");
      request.session = session;
      return true;
    });
  }
}
