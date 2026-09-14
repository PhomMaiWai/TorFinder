import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
