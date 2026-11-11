import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module";
import { DatabaseModule } from "../database/database.module";
import { SimilarController } from "./similar.controller";
import { SimilarService } from "./similar.service";

/** "Find similar" TORs (issue #255). Its own module: TorModule can't import AiModule without a cycle. */
@Module({
  imports: [DatabaseModule, AiModule],
  controllers: [SimilarController],
  providers: [SimilarService],
})
export class SimilarModule {}
