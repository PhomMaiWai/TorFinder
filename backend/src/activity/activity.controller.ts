import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { ActivityService } from "./activity.service";

/**
 * Admin-only throughout: the log names who did what, and the overview counts
 * things the public listings deliberately don't expose.
 */
@Controller("activity")
@UseGuards(AdminGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  recent(@Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number) {
    return this.activity.recent(limit);
  }

  @Get("overview")
  overview() {
    return this.activity.overview();
  }
}
