import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { TorController } from "./tor.controller";
import { TorService } from "./tor.service";

@Module({
  imports: [DatabaseModule],
  controllers: [TorController],
  providers: [TorService],
})
export class TorModule {}
