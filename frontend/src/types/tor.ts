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
  /** Structured procurement facts e-GP has on file — real, not inferred. */
  procurementMethod?: string;
  procurementType?: string;
  goodsCategory?: string;
  contractStatus?: string;
};
