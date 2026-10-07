import { Certification } from "./requirements";
import { WorkType } from "./work-types";

/** The company facts matching reads — a subset of the stored profile. */
export type MatchCandidate = {
  companyName: string;
  workTypes: WorkType[];
  /** Largest single public-sector contract completed, baht. */
  largestPastContract?: number | null;
  registeredCapital?: number | null;
  /** Undefined until the company has answered; an empty list means "none". */
  certifications?: Certification[];
  preferredBudgetMin?: number | null;
  preferredBudgetMax?: number | null;
};

/** One requirement from the bidding document, checked against the profile. */
export type EligibilityCheck = {
  requirement: string;
  /** "unknown" when the profile doesn't say — never assumed either way. */
  status: "pass" | "fail" | "unknown";
};

export type MatchResult = {
  /** 0-100: the kind of work, whether the company qualifies, and the project size. */
  score: number;
  /** Why it scored well — shown to the reader, not just to the developer. */
  reasons: string[];
  /** What stands in the way, or what the profile still has to say. */
  gaps: string[];
  eligibility: EligibilityCheck[];
  /** False when a stated requirement fails; true only when every one passes. */
  eligible: boolean | null;
};

export type RankedCompany = Pick<MatchCandidate, "companyName" | "workTypes"> & MatchResult;
