import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { MatchingModule } from "../matching/matching.module";

import { InsightsController } from "./insights.controller";
import { InsightsService } from "./insights.service";

@Module({
  imports: [DatabaseModule, MatchingModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
