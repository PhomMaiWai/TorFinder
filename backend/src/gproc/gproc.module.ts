import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { TorModule } from "../tor/tor.module";
import { GprocClient } from "./gproc.client";
import { GprocController } from "./gproc.controller";
import { GprocScheduler } from "./gproc.scheduler";
import { GprocService } from "./gproc.service";

@Module({
  imports: [DatabaseModule, TorModule],
  controllers: [GprocController],
  providers: [GprocClient, GprocService, GprocScheduler],
  // The extractor reads signed invitations through the same client.
  exports: [GprocClient],
})
export class GprocModule {}
