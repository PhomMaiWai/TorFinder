import { TorDoc } from "../database/database.service";
import { TorExtraction } from "./ai.types";

/** The figures both the document and the portal state, so one can check the other. */
export const CHECKED_FIELDS = ["budgetAmount", "referencePrice"] as const;
export type CheckedField = (typeof CHECKED_FIELDS)[number];

export type ConfidenceLevel = "high" | "medium" | "low";

export type ExtractionConfidence = {
  /** 0-1, from what could be checked — not the model's word alone. */
  score: number;
  level: ConfidenceLevel;
  /** Figures the document and the portal agree on. */
  confirmed: CheckedField[];
  /** Figures that differ from the portal's: the reader should check the document. */
  verify: CheckedField[];
};

/** The blocks a full TOR answers; a cover notice answers one or two. */
const COVERAGE_FIELDS = [
  (e: TorExtraction) => Boolean(e.scope),
  (e: TorExtraction) => e.qualifications.length > 0,
  (e: TorExtraction) => e.deliverables.length > 0,
  (e: TorExtraction) => e.budgetAmount !== null || e.referencePrice !== null,
  (e: TorExtraction) => Boolean(e.contractPeriod),
  (e: TorExtraction) => (e.paymentTerms ?? []).length > 0,
];

/** Rounding and VAT wording move a figure by a few baht, never by a percent. */
const SAME_AMOUNT = 0.01;
/** Each figure that contradicts the portal costs this share of the score. */
const MISMATCH_PENALTY = 0.25;
const HIGH = 0.8;
const MEDIUM = 0.6;

/**
 * How far an extraction can be trusted, judged on evidence rather than taken
 * from the model: its own estimate, how much of a TOR it actually found, and
 * whether the money figures match what the agency published on the portal.
 * Worked out on read, so every stored extraction gets it without re-reading.
 */
export function assessConfidence(
  extraction: TorExtraction,
  portal: Pick<TorDoc, "budgetAmount" | "referencePrice">,
): ExtractionConfidence {
  const confirmed: CheckedField[] = [];
  const verify: CheckedField[] = [];
  for (const field of CHECKED_FIELDS) {
    const read = extraction[field];
    const published = portal[field];
    if (!read || !published) continue;
    (Math.abs(read - published) / published <= SAME_AMOUNT ? confirmed : verify).push(field);
  }

  const coverage = COVERAGE_FIELDS.filter((found) => found(extraction)).length / COVERAGE_FIELDS.length;
  // Multiplied, not averaged: a model sure of a document that is only a cover notice is still wrong to be.
  let score = extraction.confidence * (0.4 + 0.6 * coverage);
  score *= (1 - MISMATCH_PENALTY) ** verify.length;
  if (verify.length === 0 && confirmed.length > 0) score += 0.05;
  score = Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;

  return {
    score,
    level: score >= HIGH ? "high" : score >= MEDIUM ? "medium" : "low",
    confirmed,
    verify,
  };
}
