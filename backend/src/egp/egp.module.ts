import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { EgpController } from "./egp.controller";
import { EgpService } from "./egp.service";

@Module({
  imports: [DatabaseModule],
  controllers: [EgpController],
  providers: [EgpService],
})
export class EgpModule {}
