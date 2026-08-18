export type OpportunityStage = "เปิดรับฟังความคิดเห็น" | "ประกาศ TOR" | "ประกาศผู้ชนะ";

export type BudgetStatus = "สูงกว่าปกติ" | "ต่ำกว่าปกติ" | "ปกติ";

export type Opportunity = {
  id: number;
  title: string;
  agency: string;
  budget: string;
  deadline: string;
  daysLeft: number;
  match: number;
  tags: string[];
  stage: OpportunityStage;
  summary: string;
  
  isNew?: boolean;
  budgetStatus?: BudgetStatus;
  hasVendorMismatch?: boolean;
};

export type OpportunityFilter =
  | "ทั้งหมด"
  | "ตรงกับคุณสูง"
  | OpportunityStage;
