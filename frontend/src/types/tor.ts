export type TorStage = "เปิดรับฟังความคิดเห็น" | "ประกาศ TOR" | "ประกาศผู้ชนะ";
export type TorBudgetStatus = "สูงกว่าปกติ" | "ต่ำกว่าปกติ" | "ปกติ";

/**
 * Where a record came from: what an admin typed in, or the portal that
 * published it. Mirrors the backend's TOR_SOURCES — the listing filters on it.
 */
export const TOR_SOURCES = ["manual", "egp", "gproc", "mea", "datagov"] as const;
export type TorSource = (typeof TOR_SOURCES)[number];

/**
 * Whether a company can still act on an announcement, decided by the backend
 * from the portal's paper trail first and the closing date second. "unknown"
 * means neither says — it is never a polite word for "open".
 */
export type BiddingStatus = "open" | "closed" | "unknown";
export type BiddingReason = "awarded" | "contracted" | "cancelled" | "superseded" | "deadline";

export type Bidding = {
  status: BiddingStatus;
  reason: BiddingReason | null;
  /** When the announcement that opened this stage was published. */
  opensAt?: string | null;
  /** ISO timestamp, end of the closing day in Bangkok. */
  closesAt: string | null;
  /** The portal published the date, or a model read it from the document. */
  closesAtSource: "portal" | "document" | null;
};

export type TorContract = {
  vendor: string;
  number: string | null;
  signedAt: string | null;
  amount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Days. Older records hold the portal's string form. */
  durationDays: number | string | null;
};

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
  /** ราคากลาง — the agency's price estimate; the national e-GP prints this, not a budget. */
  referencePrice?: number;
  /** What the winning bid came to, on the announcements that publish it. */
  awardedAmount?: number;
  /** Every announcement e-GP holds for the project, newest first. */
  documents?: { label: string; publishedAt: string | null; url: string }[];
  /** Set while the announcement is hidden from listings; absent when live. */
  deletedAt?: string;
  /** Present once a model has read the announcement document. */
  extraction?: TorExtraction;
  /** Sent by the backend; absent on the showcase records. */
  bidding?: Bidding;
  /** Signed contracts e-GP has on file, once the project has a winner. */
  contracts?: TorContract[];
  /** When the record first entered the database. */
  importedAt?: string;
  /** The project's current step on the national e-GP, as its own flow names it. */
  procurementStep?: { name: string | null; stage: string | null; checkedAt: string };
  /** When the portal's detail was last fetched. */
  enrichedAt?: string;
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
  /*
   * Read since extraction v2; a record extracted earlier lacks them until it is
   * read again.
   */
  objectives?: string[];
  referencePrice?: number | null;
  evaluationCriteria?: string | null;
  paymentTerms?: string[];
  bidSecurity?: string | null;
  penalty?: string | null;
  warrantyPeriod?: string | null;
  contact?: string | null;
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

/**
 * Mirrors the backend's WORK_TYPES: the kinds of IT contract a company takes
 * on, grouped the way the profile page lays them out.
 */
export const WORK_TYPE_GROUPS = {
  software: ["development", "web", "mobile", "erp", "eservice"],
  services: ["maintenance", "helpdesk", "license", "consulting"],
  infrastructure: ["hardware", "peripherals", "network", "datacenter", "security"],
  domains: ["data", "ai", "gis", "health", "education"],
} as const;
export const WORK_TYPES = Object.values(WORK_TYPE_GROUPS).flat();
export type WorkType = (typeof WORK_TYPES)[number];

/** Mirrors the backend's CERTIFICATIONS. */
export const CERTIFICATIONS = ["iso9001", "iso14001", "iso27001", "iso20000", "cmmi", "dealer"] as const;
export type Certification = (typeof CERTIFICATIONS)[number];

/** One requirement from the bidding document, checked against a company profile. */
export type EligibilityCheck = { requirement: string; status: "pass" | "fail" | "unknown" };

type MatchFields = {
  reasons: string[];
  gaps: string[];
  eligibility: EligibilityCheck[];
  /** False when a stated requirement fails; true only when every one passes. */
  eligible: boolean | null;
};

export type MatchedCompany = MatchFields & {
  companyName: string;
  workTypes: WorkType[];
  score: number;
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

/** An announcement scored for one company — what the dashboard ranks by. */
export type ScoredTor = TorRecord & MatchFields & { match: number };
