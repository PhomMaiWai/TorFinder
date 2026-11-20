import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { AdminApprovalsService } from "./admin-approvals.service";
import { RoleChangesService } from "./role-changes.service";

@Module({
  imports: [DatabaseModule, NotificationsModule, AuditModule, AuthModule],
  controllers: [AccountsController],
  providers: [AccountsService, AdminApprovalsService, RoleChangesService],
})
export class AccountsModule {}
