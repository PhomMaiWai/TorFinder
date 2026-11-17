import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { CertificatesController } from "./certificates.controller";
import { CertificatesService } from "./certificates.service";

@Module({
  imports: [DatabaseModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
