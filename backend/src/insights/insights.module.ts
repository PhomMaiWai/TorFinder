import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";

import { InsightsController } from "./insights.controller";
import { InsightsService } from "./insights.service";

@Module({
  imports: [DatabaseModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
