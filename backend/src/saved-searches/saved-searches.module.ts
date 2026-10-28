import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { SavedSearchesController } from "./saved-searches.controller";
import { SavedSearchesService } from "./saved-searches.service";

@Module({
  imports: [DatabaseModule],
  controllers: [SavedSearchesController],
  providers: [SavedSearchesService],
})
export class SavedSearchesModule {}
