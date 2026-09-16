import { Module } from "@nestjs/common";

import { TorModule } from "../tor/tor.module";
import { MeaClient } from "./mea.client";
import { MeaController } from "./mea.controller";
import { MeaScheduler } from "./mea.scheduler";
import { MeaService } from "./mea.service";

@Module({
  imports: [TorModule],
  controllers: [MeaController],
  providers: [MeaService, MeaClient, MeaScheduler],
})
export class MeaModule {}
