import { Injectable, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { DatabaseService } from "../database/database.service";
import { PROPOSAL_INSTRUCTION, PROPOSAL_SCHEMA, ProposalDraft, proposalPrompt, sanitizeDraft } from "./proposal-draft";
import { VertexClient } from "./vertex.client";

/** A full proposal runs long in Thai; the extraction default would cut it off. */
const DRAFT_OUTPUT_TOKENS = 32_768;
const DRAFT_TEMPERATURE = 0.4;

@Injectable()
export class ProposalService {
  constructor(
    private readonly db: DatabaseService,
    private readonly vertex: VertexClient,
  ) {}

  /**
   * A first draft for one announcement, written from a proposal the company
   * already submitted elsewhere and its own profile. A starting point to edit,
   * never something to submit as-is — the model is told to leave a marked gap
   * rather than invent a credential.
   */
  async draft(userId: string, torId: string, previousProposal: string): Promise<ProposalDraft> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");

    const [tor, user] = await Promise.all([
      this.db.tors.findOne(
        { _id: new ObjectId(torId), deletedAt: { $exists: false } },
        {
          projection: {
            title: 1,
            agency: 1,
            summary: 1,
            budgetAmount: 1,
            referencePrice: 1,
            "extraction.scope": 1,
            "extraction.objectives": 1,
            "extraction.qualifications": 1,
            "extraction.deliverables": 1,
            "extraction.evaluationCriteria": 1,
            "extraction.contractPeriod": 1,
          },
        },
      ),
      ObjectId.isValid(userId)
        ? this.db.users.findOne({ _id: new ObjectId(userId) }, { projection: { company: 1 } })
        : null,
    ]);
    if (!tor) throw new NotFoundException("ไม่พบรายการ TOR");

    const raw = await this.vertex.extractJson<Partial<ProposalDraft>>(
      PROPOSAL_INSTRUCTION,
      proposalPrompt(tor, user?.company, previousProposal),
      [],
      PROPOSAL_SCHEMA,
      { maxOutputTokens: DRAFT_OUTPUT_TOKENS, temperature: DRAFT_TEMPERATURE },
    );
    return sanitizeDraft(raw);
  }
}
