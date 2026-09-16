import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { MatchingModule } from "../matching/matching.module";
import { TorController } from "./tor.controller";
import { TorImportService } from "./tor-import.service";
import { TorService } from "./tor.service";

@Module({
  imports: [DatabaseModule, MatchingModule],
  controllers: [TorController],
  providers: [TorService, TorImportService],
  exports: [TorImportService],
})
export class TorModule {}
