import { Controller, Get, Param, Post } from "@nestjs/common";

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
   * spending a model call. Deliberately says nothing about credentials beyond
   * "configured or not".
   */
  @Get("status")
  status() {
    return {
      configured: this.vertex.isConfigured,
      model: env.ai.model,
      location: env.ai.location,
    };
  }

  /** Read one announcement's document now, rather than waiting for a batch. */
  @Post("extract/:torId")
  extract(@Param("torId") torId: string) {
    return this.extraction.extractForTor(torId);
  }
}
