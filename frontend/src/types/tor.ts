export type TorStage = "เปิดรับฟังความคิดเห็น" | "ประกาศ TOR" | "ประกาศผู้ชนะ";
export type TorBudgetStatus = "สูงกว่าปกติ" | "ต่ำกว่าปกติ" | "ปกติ";

export type TorRecord = {
  id: string;
  title: string;
  agency: string;
  budget: string;
  deadline: string;
  daysLeft: number;
  match: number;
  tags: string[];
  stage: TorStage;
  summary: string;
  budgetStatus?: TorBudgetStatus;
  createdAt: string;
  /** Only the seeded showcase records carry these. */
  isNew?: boolean;
  hasVendorMismatch?: boolean;
  /** Present only on records imported from the e-GP announcement feed. */
  sourceRef?: string;
  sourceUrl?: string;
  /** e-GP's project number, printed on every announcement of the project. */
  projectNumber?: string;
  budgetAmount?: number;
  /** Every announcement e-GP holds for the project, newest first. */
  documents?: { label: string; publishedAt: string | null; url: string }[];
  /** Present once a model has read the announcement document. */
  extraction?: TorExtraction;
  /** Structured procurement facts e-GP has on file — real, not inferred. */
  procurementMethod?: string;
  procurementType?: string;
  goodsCategory?: string;
  contractStatus?: string;
};

/** What a model read out of the announcement document — inferred, not published. */
export type TorExtraction = {
  scope: string | null;
  qualifications: string[];
  deliverables: string[];
  budgetAmount: number | null;
  contractPeriod: string | null;
  deadline: string | null;
  /** 0-1; low values are shown as needing a look at the source document. */
  confidence: number;
  model: string;
  documentUrl: string;
  extractedAt: string;
};

/** How this budget compares with announcements about the same kind of work. */
export type BudgetAssessment = {
  status: "สูงกว่าปกติ" | "ต่ำกว่าปกติ" | "ปกติ" | "ไม่ประเมิน";
  budget: number | null;
  median: number | null;
  peerCount: number;
  ratio: number | null;
  notes: string[];
};

export type MatchedCompany = {
  companyName: string;
  specialty: string;
  size: string;
  score: number;
  reasons: string[];
  gaps: string[];
};

export type TorFeedback = {
  id: string;
  torId: string;
  author: string;
  text: string;
  status: "รอตรวจสอบ" | "อนุมัติ" | "ปฏิเสธ";
  createdAt: string;
  reviewedAt?: string;
};
