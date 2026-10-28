import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { AdminAlertsService } from "./admin-alerts.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [DatabaseModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, AdminAlertsService],
  exports: [NotificationsService, AdminAlertsService],
})
export class NotificationsModule {}
