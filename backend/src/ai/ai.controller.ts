import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { env } from "../config/env";
import { ExtractionService } from "./extraction.service";
import { VertexClient } from "./vertex.client";

@Controller("ai")
export class AiController {
  constructor(
    private readonly vertex: VertexClient,
    private readonly extraction: ExtractionService,
  ) {}

  /**
   * Whether extraction can run at all, so a deployment can be checked without
   * spending a model call. The only unguarded route here: it spends nothing and
   * deliberately says nothing about credentials beyond "configured or not",
   * while both routes below cost a model call each and take an admin session.
   */
  @Get("status")
  status() {
    return {
      configured: this.vertex.isConfigured,
      model: env.ai.model,
      location: env.ai.location,
    };
  }

  /** Read everything still unextracted, up to this run's call budget. */
  @Post("extract")
  @UseGuards(AdminGuard)
  extractPending() {
    return this.extraction.extractPending();
  }

  /** Read one announcement's document now, rather than waiting for a batch. */
  @Post("extract/:torId")
  @UseGuards(AdminGuard)
  extract(@Param("torId") torId: string) {
    return this.extraction.extractForTor(torId);
  }
}
