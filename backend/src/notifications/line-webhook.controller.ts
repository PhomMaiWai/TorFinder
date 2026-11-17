import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Request } from "express";

import { logSecurityEvent } from "../common/security-log";
import { env } from "../config/env";
import { LineEvent, verifyLineSignature } from "./line-link";
import { NotificationsService } from "./notifications.service";

/**
 * Called by LINE, not by a browser — no session. What makes a call genuine is
 * the X-Line-Signature over the raw body, made with the channel secret only
 * LINE and this server know. Set the Webhook URL in the LINE Developers
 * console to https://<site>/api/line/webhook (the frontend passes it through).
 */
@Controller("line")
@SkipThrottle()
export class LineWebhookController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-line-signature") signature: string | undefined,
    @Body() body: { events?: LineEvent[] },
  ) {
    if (!request.rawBody || !verifyLineSignature(request.rawBody, signature, env.notify.lineChannelSecret)) {
      logSecurityEvent("line.webhook.bad_signature", { outcome: "failure", ip: request.ip, path: request.path });
      throw new UnauthorizedException();
    }
    await this.notifications.handleLineEvents(Array.isArray(body?.events) ? body.events : []);
    return {};
  }
}
