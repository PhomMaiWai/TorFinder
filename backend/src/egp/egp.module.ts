import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { EgpClient } from "./egp.client";
import { EgpController } from "./egp.controller";
import { EgpScheduler } from "./egp.scheduler";
import { EgpService } from "./egp.service";

@Module({
  imports: [DatabaseModule],
  controllers: [EgpController],
  providers: [EgpService, EgpClient, EgpScheduler],
})
export class EgpModule {}
