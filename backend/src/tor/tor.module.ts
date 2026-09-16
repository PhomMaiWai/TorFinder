import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { TorController } from "./tor.controller";
import { TorService } from "./tor.service";

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [TorController],
  providers: [TorService],
})
export class TorModule {}
