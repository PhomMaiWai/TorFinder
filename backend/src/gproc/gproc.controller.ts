import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { AdminGuard } from "../common/admin.guard";
import { AuthenticatedRequest } from "../common/session.guard";
import { CaptureDto } from "./dto/capture.dto";
import { GprocService } from "./gproc.service";

/**
 * Admin-only: a capture reads the national e-GP on the admin's behalf and
 * changes what every visitor sees.
 */
@Controller("gproc")
@UseGuards(AdminGuard)
export class GprocController {
  constructor(
    private readonly gproc: GprocService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Accepted at once and processed in the background; poll the run for the
   * result. The entry records what was asked for — the outcome is the run's.
   */
  @Post("capture")
  @HttpCode(HttpStatus.ACCEPTED)
  async capture(@Body() dto: CaptureDto, @Req() request: AuthenticatedRequest) {
    const run = this.gproc.startCapture(dto.projectNumbers);
    await this.audit.record(
      request.session.email,
      "สั่งนำเข้าจาก e-GP กรมบัญชีกลาง",
      `${run.total} โครงการ: ${dto.projectNumbers.join(", ")}`,
    );
    return run;
  }

  @Get("capture/:runId")
  run(@Param("runId", ParseUUIDPipe) runId: string) {
    return this.gproc.getRun(runId);
  }
}
