import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { AccountLinksService } from "./account-links.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, AccountLinksService],
})
export class AuthModule {}
