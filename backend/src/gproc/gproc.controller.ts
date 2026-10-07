import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { CaptureDto } from "./dto/capture.dto";
import { GprocService } from "./gproc.service";

/**
 * Admin-only: a capture reads the national e-GP on the admin's behalf and
 * changes what every visitor sees.
 */
@Controller("gproc")
@UseGuards(AdminGuard)
export class GprocController {
  constructor(private readonly gproc: GprocService) {}

  /** Accepted at once and processed in the background; poll the run for the result. */
  @Post("capture")
  @HttpCode(HttpStatus.ACCEPTED)
  capture(@Body() dto: CaptureDto) {
    return this.gproc.startCapture(dto.projectNumbers);
  }

  @Get("capture/:runId")
  run(@Param("runId", ParseUUIDPipe) runId: string) {
    return this.gproc.getRun(runId);
  }
}
