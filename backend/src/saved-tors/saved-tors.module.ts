import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { SavedTorsController } from "./saved-tors.controller";
import { SavedTorsService } from "./saved-tors.service";

@Module({
  imports: [DatabaseModule],
  controllers: [SavedTorsController],
  providers: [SavedTorsService],
})
export class SavedTorsModule {}
