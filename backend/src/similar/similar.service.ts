import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";

import { VertexClient } from "../ai/vertex.client";
import { mapWithLimit } from "../common/concurrency";
import { env } from "../config/env";
import { DatabaseService } from "../database/database.service";
import { LISTED_TOR } from "../tor/tor.constants";
import { denseCosine, displayScore, keywordScores, type SimilarSource, torText } from "./similar-text";
import { SIMILAR, type SimilarMethod } from "./similar.constants";

type Candidate = SimilarSource & {
  _id: ObjectId;
  agency: string;
  stage: string;
  projectNumber?: string;
};

export type SimilarTor = {
  id: string;
  title: string;
  agency: string;
  stage: string;
  projectNumber?: string;
  /** 0-100, for comparing results of one search with each other. */
  similarity: number;
  /** The words this TOR shares with the query that weighed most, best first. */
  sharedTerms: string[];
};

export type SimilarResponse = {
  /** "ai" when Vertex AI embeddings ranked the results, "keyword" when shared words did. */
  method: SimilarMethod;
  /** The TOR the search started from, when it started from one. */
  basedOn: { id: string; title: string } | null;
  results: SimilarTor[];
};

const PROJECTION = {
  title: 1,
  agency: 1,
  stage: 1,
  summary: 1,
  tags: 1,
  projectNumber: 1,
  procurementType: 1,
  goodsCategory: 1,
  "extraction.scope": 1,
  "extraction.objectives": 1,
} as const;

const hashOf = (text: string) => createHash("sha1").update(text).digest("hex");

/**
 * "Find similar" (issue #255): a past project, a company profile or one TOR in,
 * the listed TORs most like it out. Ranked by Vertex AI embeddings when Vertex
 * is configured, by shared keywords (TF-IDF) when it is not — or when the model
 * fails, so the feature never goes dark because of the model.
 */
@Injectable()
export class SimilarService {
  private readonly logger = new Logger(SimilarService.name);
  /** One background backfill at a time; a second request just uses keywords meanwhile. */
  private backfill: Promise<void> | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly vertex: VertexClient,
  ) {}

  async findSimilar(input: { text?: string; torId?: string; limit?: number }): Promise<SimilarResponse> {
    const text = input.text?.trim() ?? "";
    if (Boolean(text) === Boolean(input.torId)) {
      throw new BadRequestException("ระบุอย่างใดอย่างหนึ่ง: ข้อความ (text) หรือ TOR ต้นแบบ (torId)");
    }
    if (text && text.length < SIMILAR.minQueryChars) {
      throw new BadRequestException(`กรุณาอธิบายโครงการอย่างน้อย ${SIMILAR.minQueryChars} ตัวอักษร`);
    }
    const limit = Math.min(input.limit ?? SIMILAR.defaultLimit, SIMILAR.maxLimit);

    const source = input.torId ? await this.sourceTor(input.torId) : null;
    const query = source ? torText(source) : text;

    // The source TOR and the other announcements of its own project (its plan,
    // draft or award) are the same work, not similar work.
    const candidates = (
      await this.db.tors
        .find<Candidate>(
          { ...LISTED_TOR, createdAt: { $gte: env.torListedSince } },
          { projection: PROJECTION },
        )
        .toArray()
    ).filter(
      (tor) =>
        !source ||
        (!tor._id.equals(source._id) && !(source.projectNumber && tor.projectNumber === source.projectNumber)),
    );
    const texts = candidates.map(torText);
    const keywords = keywordScores(query, texts);

    let method: SimilarMethod = "keyword";
    let scores = keywords.map((k) => k.score);
    if (this.vertex.isConfigured && candidates.length > 0) {
      const semantic = await this.semanticScores(query, source, candidates, texts).catch((error: unknown) => {
        this.logger.warn(`Similar TORs fell back to keywords: ${String(error)}`);
        return null;
      });
      if (semantic) {
        method = "ai";
        scores = semantic;
      }
    }

    const results = candidates
      .map((tor, i) => ({ tor, score: scores[i], shared: keywords[i].shared }))
      .filter(({ score }) => (method === "ai" ? score > 0 : score >= SIMILAR.minKeywordScore))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ tor, score, shared }) => ({
        id: tor._id.toString(),
        title: tor.title,
        agency: tor.agency,
        stage: tor.stage,
        ...(tor.projectNumber ? { projectNumber: tor.projectNumber } : {}),
        similarity: displayScore(score, method),
        sharedTerms: shared,
      }));

    return {
      method,
      basedOn: source ? { id: source._id.toString(), title: source.title } : null,
      results,
    };
  }

  private async sourceTor(id: string): Promise<Candidate> {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบรายการ TOR");
    const tor = await this.db.tors.findOne<Candidate>(
      { _id: new ObjectId(id), deletedAt: { $exists: false } },
      { projection: PROJECTION },
    );
    if (!tor) throw new NotFoundException("ไม่พบรายการ TOR");
    return tor;
  }

  /**
   * Embedding cosine of every candidate against the query, or null when too
   * many candidates still lack a vector to wait for them — the backfill then
   * runs in the background and the next search gets the AI ranking.
   */
  private async semanticScores(
    query: string,
    source: Candidate | null,
    candidates: Candidate[],
    texts: string[],
  ): Promise<number[] | null> {
    const vectors = await this.storedVectors(candidates, texts);
    const missing = candidates
      .map((tor, i) => ({ id: tor._id, text: texts[i] }))
      .filter(({ id }) => !vectors.has(id.toString()));

    if (missing.length > SIMILAR.inlineBackfillMax) {
      this.backfillInBackground(missing);
      return null;
    }
    for (const [id, vector] of await this.embedAndStore(missing)) vectors.set(id, vector);

    const queryVector = source
      ? (await this.embedAndStore([{ id: source._id, text: query }], true)).get(source._id.toString())
      : (await this.vertex.embed([query.slice(0, SIMILAR.embedTextChars * 2)]))[0];
    if (!queryVector) return null;

    return candidates.map((tor) => {
      const vector = vectors.get(tor._id.toString());
      return vector ? denseCosine(queryVector, vector) : 0;
    });
  }

  /** Stored vectors still made from the TOR's current text by the current model. */
  private async storedVectors(candidates: Candidate[], texts: string[]): Promise<Map<string, number[]>> {
    const wanted = new Map(candidates.map((tor, i) => [tor._id.toString(), hashOf(texts[i])]));
    const rows = await this.db.torEmbeddings
      .find(
        { torId: { $in: candidates.map((tor) => tor._id) }, model: env.ai.embeddingModel },
        { projection: { torId: 1, textHash: 1, vector: 1 } },
      )
      .toArray();

    const vectors = new Map<string, number[]>();
    for (const row of rows) {
      const id = row.torId.toString();
      if (wanted.get(id) === row.textHash) vectors.set(id, row.vector);
    }
    return vectors;
  }

  /**
   * Embeds the texts in batches and upserts the vectors. `reuse` first looks
   * for a vector that is already current, for the single source TOR.
   */
  private async embedAndStore(
    items: { id: ObjectId; text: string }[],
    reuse = false,
  ): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();
    if (items.length === 0) return result;
    if (reuse) {
      const found = await this.storedVectors(
        items.map(({ id, text }) => ({ _id: id, title: text, agency: "", stage: "" })),
        items.map(({ text }) => text),
      );
      if (found.size === items.length) return found;
    }

    const batches: { id: ObjectId; text: string }[][] = [];
    for (let i = 0; i < items.length; i += SIMILAR.embedBatchSize) {
      batches.push(items.slice(i, i + SIMILAR.embedBatchSize));
    }

    await mapWithLimit(batches, SIMILAR.embedConcurrency, () => true, async (batch) => {
      const vectors = await this.vertex.embed(batch.map(({ text }) => text));
      const now = new Date();
      await this.db.torEmbeddings.bulkWrite(
        batch.map(({ id, text }, i) => ({
          updateOne: {
            filter: { torId: id, model: env.ai.embeddingModel },
            update: { $set: { textHash: hashOf(text), vector: vectors[i], updatedAt: now } },
            upsert: true,
          },
        })),
      );
      batch.forEach(({ id }, i) => result.set(id.toString(), vectors[i]));
    });
    return result;
  }

  private backfillInBackground(items: { id: ObjectId; text: string }[]): void {
    if (this.backfill) return;
    this.logger.log(`Embedding ${items.length} TORs for find-similar in the background`);
    this.backfill = this.embedAndStore(items)
      .then((done) => this.logger.log(`Embedded ${done.size} TORs for find-similar`))
      .catch((error: unknown) => this.logger.warn(`Find-similar backfill failed: ${String(error)}`))
      .finally(() => {
        this.backfill = null;
      });
  }
}
