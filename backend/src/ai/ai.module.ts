import { Module } from "@nestjs/common";

import { ActivityModule } from "../activity/activity.module";
import { DatabaseModule } from "../database/database.module";
import { AiController } from "./ai.controller";
import { ExtractionScheduler } from "./extraction.scheduler";
import { ExtractionService } from "./extraction.service";
import { VertexClient } from "./vertex.client";

@Module({
  imports: [ActivityModule, DatabaseModule],
  controllers: [AiController],
  providers: [VertexClient, ExtractionService, ExtractionScheduler],
  exports: [VertexClient, ExtractionService],
})
export class AiModule {}
