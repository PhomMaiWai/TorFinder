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
};
