export type TorStage =
  | "แผนการจัดซื้อจัดจ้าง"
  | "เปิดรับฟังความคิดเห็น"
  | "ประกาศราคากลาง"
  | "ประกาศ TOR"
  | "ประกาศผู้ชนะ";

/** Lifecycle order, as the API stores it. */
export const TOR_STAGES: readonly TorStage[] = [
  "แผนการจัดซื้อจัดจ้าง",
  "เปิดรับฟังความคิดเห็น",
  "ประกาศราคากลาง",
  "ประกาศ TOR",
  "ประกาศผู้ชนะ",
];
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
  /** The hours bids are taken on the closing day, "09:00–12:00", when the document says. */
  submissionTime?: string | null;
};

/** One step of the project's journey; the API sends all five, in lifecycle order. */
export type TimelineEntry = {
  stage: TorStage;
  /** The portal's paper trail, or the record itself, shows the project got here. */
  reached: boolean;
  /** The stage this record is; exactly one entry. */
  current: boolean;
  /** ISO timestamp of the earliest announcement for the stage, when it has a date. */
  publishedAt: string | null;
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

export const TOR_CLASSIFICATIONS = ["software", "not-software"] as const;
export type TorClassification = (typeof TOR_CLASSIFICATIONS)[number];

export const CLASSIFICATION_LABEL: Record<TorClassification, string> = {
  software: "งานซอฟต์แวร์",
  "not-software": "ไม่ใช่งานซอฟต์แวร์",
};

/** How the admin pages name each field an admin can correct (and lock). */
export const TOR_FIELD_LABEL: Record<string, string> = {
  title: "ชื่อโครงการ",
  agency: "หน่วยงาน",
  budget: "งบประมาณ",
  deadline: "วันที่ปิดรับ",
  daysLeft: "จำนวนวันที่เหลือ",
  tags: "แท็ก",
  stage: "สถานะ TOR",
  summary: "รายละเอียด",
  budgetStatus: "สถานะงบประมาณ",
  classification: "ประเภทงาน",
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
  documents?: {
    label: string;
    publishedAt: string | null;
    url: string;
    /** A PDF the site can show in place; otherwise a page on the portal to link to. */
    viewable?: boolean;
    /** A zipped bundle whose PDFs and images can be listed and shown one by one. */
    archive?: boolean;
  }[];
  /** Set while the announcement is hidden from listings; absent when live. */
  deletedAt?: string;
  /** Absent means software; an admin marks a record "not-software" to take it out of the listings. */
  classification?: TorClassification;
  /** The last admin correction. */
  lastEdited?: { by: string; at: string };
  /** Fields an admin corrected, which a re-import leaves alone. */
  lockedFields?: string[];
  /** The project owner account an admin linked it to; absent when nobody is. */
  ownerId?: string;
  /** Present once a model has read the announcement document. */
  extraction?: TorExtraction;
  /** Sent by the backend; absent on the showcase records. */
  bidding?: Bidding;
  /** Sent by the backend; absent on the showcase records. */
  timeline?: TimelineEntry[];
  currentStage?: TorStage;
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
  /** The model's own estimate, 0-1. Shown only through `assessment`. */
  confidence: number;
  model: string;
  documentUrl: string;
  extractedAt: string;
  /** Worked out by the backend on read; absent on mock records. */
  assessment?: ExtractionAssessment;
};

/** Figures both the document and the portal state, so one checks the other. */
export type CheckedField = "budgetAmount" | "referencePrice";

/** How far an extraction can be trusted, judged on evidence, not the model's word. */
export type ExtractionAssessment = {
  score: number;
  level: "high" | "medium" | "low";
  /** Figures that match what the agency published on e-GP. */
  confirmed: CheckedField[];
  /** Figures that differ from e-GP's: the reader should check the document. */
  verify: CheckedField[];
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

/** A suggested bid and how contested the work is — mirrors the backend's BidInsight. */
export type BidInsight = {
  status: "ok" | "insufficient";
  base: number | null;
  baseKind: "reference" | "budget" | null;
  peerCount: number;
  broad: boolean;
  medianDiscount: number | null;
  averageDiscount: number | null;
  competition: "blue" | "moderate" | "red" | null;
  distinctWinners: number;
  topWinners: { vendor: string; wins: number }[];
  pricePoints: {
    label: "aggressive" | "recommended" | "conservative";
    price: number;
    ratio: number;
    winChance: number;
  }[];
  recentAwards: {
    projectNumber: string | null;
    title: string;
    vendor: string | null;
    base: number;
    awarded: number;
    discount: number;
  }[];
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

/**
 * International standards, grouped the way a company thinks of them. Labels
 * are the standards' own names, the same in every language. Together with
 * "dealer" this mirrors the backend's CERTIFICATIONS.
 */
export const STANDARD_GROUPS = {
  software: [
    { id: "iso29110", label: "ISO/IEC 29110" },
    { id: "cmmi3", label: "CMMI Level 3" },
    { id: "cmmi5", label: "CMMI Level 5" },
    { id: "iso12207", label: "ISO/IEC 12207" },
    { id: "iso25010", label: "ISO/IEC 25010" },
  ],
  security: [
    { id: "iso27001", label: "ISO/IEC 27001" },
    { id: "iso27701", label: "ISO/IEC 27701" },
    { id: "iso27017", label: "ISO/IEC 27017" },
    { id: "iso27018", label: "ISO/IEC 27018" },
    { id: "pcidss", label: "PCI DSS" },
    { id: "csastar", label: "CSA STAR" },
    { id: "iso15408", label: "ISO/IEC 15408" },
  ],
  service: [
    { id: "iso20000", label: "ISO/IEC 20000-1" },
    { id: "iso22301", label: "ISO 22301" },
    { id: "tia942", label: "TIA-942" },
  ],
  quality: [
    { id: "iso9001", label: "ISO 9001" },
    { id: "iso14001", label: "ISO 14001" },
    { id: "iso42001", label: "ISO/IEC 42001" },
  ],
} as const;

export type StandardGroup = keyof typeof STANDARD_GROUPS;
export type Standard = (typeof STANDARD_GROUPS)[StandardGroup][number]["id"];
/** Not a standard: a manufacturer's letter appointing the company as its dealer. */
export type Certification = Standard | "dealer";

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
