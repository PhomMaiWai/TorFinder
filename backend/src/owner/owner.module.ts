import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { FeedbackModule } from "../feedback/feedback.module";
import { MatchingModule } from "../matching/matching.module";
import { OwnerController } from "./owner.controller";
import { OwnerService } from "./owner.service";

@Module({
  imports: [DatabaseModule, MatchingModule, FeedbackModule],
  controllers: [OwnerController],
  providers: [OwnerService],
})
export class OwnerModule {}
