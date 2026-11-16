import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerLimitDetail } from "@nestjs/throttler";
import { Request } from "express";

import { logSecurityEvent } from "./security-log";

/** The global rate limiter, plus one `rate.limited` line for every 429 it sends (ASVS 16.3.3). */
@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    logSecurityEvent("rate.limited", {
      outcome: "failure",
      ip: request.ip,
      method: request.method,
      path: request.path,
      reason: `limit_${detail.limit}_per_${Math.round(detail.ttl / 1000)}s`,
    });
    return super.throwThrottlingException(context, detail);
  }
}
