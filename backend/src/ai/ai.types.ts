/** What one PDF is expected to yield. Anything the document doesn't state is null. */
export type TorExtraction = {
  scope: string | null;
  /** วัตถุประสงค์ — why the agency is buying this. */
  objectives: string[];
  qualifications: string[];
  deliverables: string[];
  /** Budget in baht as the document states it, not the portal's figure. */
  budgetAmount: number | null;
  /** ราคากลาง in baht — the agency's own price estimate, distinct from the budget. */
  referencePrice: number | null;
  contractPeriod: string | null;
  /**
   * The last day this announcement can be acted on, in ISO date form: bid
   * submission for an invitation, the end of public comment for a draft.
   */
  deadline: string | null;
  /** เกณฑ์การพิจารณา — lowest price, or price-performance and its weights. */
  evaluationCriteria: string | null;
  /** งวดงานและการจ่ายเงิน, one instalment per item. */
  paymentTerms: string[];
  /** หลักประกันการเสนอราคา / หลักประกันสัญญา. */
  bidSecurity: string | null;
  /** อัตราค่าปรับ. */
  penalty: string | null;
  /** ระยะเวลารับประกันความชำรุดบกพร่อง. */
  warrantyPeriod: string | null;
  /** The agency's published contact for questions — an office, not a private person. */
  contact: string | null;
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
