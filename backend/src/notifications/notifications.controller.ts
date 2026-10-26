import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";

import { AuthenticatedRequest, SessionGuard } from "../common/session.guard";
import { UpdateChannelsDto } from "./dto/update-channels.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findOwn(@Req() request: AuthenticatedRequest) {
    return this.notifications.findOwn(request.session.sub);
  }

  /** Where the caller's notifications go besides this list, and which channels the server supports. */
  @Get("channels")
  channels(@Req() request: AuthenticatedRequest) {
    return this.notifications.getChannels(request.session.sub);
  }

  @Put("channels")
  updateChannels(@Req() request: AuthenticatedRequest, @Body() dto: UpdateChannelsDto) {
    return this.notifications.updateChannels(request.session.sub, dto);
  }

  @Post("channels/test")
  @HttpCode(HttpStatus.OK)
  testChannels(@Req() request: AuthenticatedRequest) {
    return this.notifications.sendTest(request.session.sub);
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
