import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Req, UseGuards } from "@nestjs/common";

import { AuthenticatedRequest, SessionGuard } from "../common/session.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findOwn(@Req() request: AuthenticatedRequest) {
    return this.notifications.findOwn(request.session.sub);
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@Req() request: AuthenticatedRequest) {
    return this.notifications.markAllRead(request.session.sub);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.notifications.markRead(request.session.sub, id);
  }
}
