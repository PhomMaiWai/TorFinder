import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { AdminGuard } from "../common/admin.guard";
import { OrgGuard } from "../common/org.guard";
import { AuthenticatedRequest } from "../common/session.guard";
import { env } from "../config/env";
import { ProposalDraftDto } from "./dto/proposal-draft.dto";
import { ExtractionService } from "./extraction.service";
import { ProposalService } from "./proposal.service";
import { VertexClient } from "./vertex.client";

@Controller("ai")
export class AiController {
  constructor(
    private readonly vertex: VertexClient,
    private readonly extraction: ExtractionService,
    private readonly proposals: ProposalService,
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

  /**
   * A first-draft proposal for one announcement, reworked from one the
   * company wrote before. Signed-in only and tightly throttled: every call
   * is a long model answer someone pays for.
   */
  @Post("proposal-draft/:torId")
  @UseGuards(OrgGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  proposalDraft(
    @Req() request: AuthenticatedRequest,
    @Param("torId") torId: string,
    @Body() dto: ProposalDraftDto,
  ) {
    return this.proposals.draft(request.session.sub, torId, dto.previousProposal);
  }
}
