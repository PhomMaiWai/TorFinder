import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { AiController } from "./ai.controller";
import { ExtractionService } from "./extraction.service";
import { VertexClient } from "./vertex.client";

@Module({
  imports: [DatabaseModule],
  controllers: [AiController],
  providers: [VertexClient, ExtractionService],
  exports: [VertexClient, ExtractionService],
})
export class AiModule {}
