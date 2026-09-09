/** The company facts scoring needs — a subset of the stored profile. */
export type MatchCandidate = {
  companyName: string;
  specialty: string;
  size: string;
};

export type MatchResult = {
  /** 0-100, where 100 is a company that covers every skill at a credible size. */
  score: number;
  /** Why it scored well — shown to the reader, not just to the developer. */
  reasons: string[];
  /** What is missing. An empty list does not mean a perfect match, only no known gap. */
  gaps: string[];
};

export type RankedCompany = MatchCandidate & MatchResult;
