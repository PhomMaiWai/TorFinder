import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

import { env } from "../config/env";
import { AuthenticatedRequest, logDenied } from "./session.guard";
import { hasRecentPasskey } from "./token";

/** What the frontend looks for to offer a passkey check and retry. */
export const STEP_UP_REQUIRED = "step-up-required";

/** Thrown when an action needs a fresh passkey check (ASVS 7.5.3). */
export class StepUpRequiredException extends ForbiddenException {
  constructor() {
    super({
      statusCode: 403,
      code: STEP_UP_REQUIRED,
      message: "กรุณายืนยันตัวตนด้วยพาสคีย์อีกครั้งก่อนทำรายการนี้",
    });
  }
}

/**
 * Sensitive admin actions — approving or rejecting a company, changing a role,
 * suspending, deleting an announcement, clearing someone's passkeys — need a
 * passkey check from the last STEP_UP_MINUTES (default 10), not just a session
 * (ASVS 7.5.3). A stolen session cookie alone can then read, but not change
 * who may do what.
 *
 * Goes after a role guard, which has already put the session on the request:
 * `@UseGuards(AdminGuard, StepUpGuard)`. Applies whenever passkeys are
 * required, and always to an account that has one; with passkeys optional,
 * an admin who never added one isn't asked for what they can't give.
 */
@Injectable()
export class StepUpGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = request.session;
    if (!session) throw new ForbiddenException();

    const applies = env.passkeys.required || session.amr?.includes("passkey");
    if (!applies || hasRecentPasskey(session, env.passkeys.stepUpMinutes)) return true;

    logDenied(request, "step_up_required", session.sub, session.role);
    throw new StepUpRequiredException();
  }
}
