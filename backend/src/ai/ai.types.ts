/** What one PDF is expected to yield. Anything the document doesn't state is null. */
export type TorExtraction = {
  scope: string | null;
  qualifications: string[];
  deliverables: string[];
  /** Budget in baht as the document states it, not the portal's figure. */
  budgetAmount: number | null;
  contractPeriod: string | null;
  /** Submission deadline in ISO date form, when the document carries one. */
  deadline: string | null;
  /** The model's own confidence, 0-1. Low values are shown as unverified. */
  confidence: number;
};

/** The extraction plus the provenance needed to judge and re-run it. */
export type StoredExtraction = TorExtraction & {
  model: string;
  documentUrl: string;
  extractedAt: Date;
  version: number;
};

/** What one batch run got through. */
export type ExtractionRunResult = {
  attempted: number;
  extracted: number;
  /** Records e-GP publishes no readable file for — nothing to retry. */
  skipped: number;
  failed: number;
};
