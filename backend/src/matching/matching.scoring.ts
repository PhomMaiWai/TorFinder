import { formatBaht } from "../tor/tor-normalize";
import {
  INELIGIBLE_CEILING,
  MIN_USEFUL_SCORE,
  OFF_TYPE_CEILING,
  SKILL_KEYWORDS,
  WEIGHTS,
} from "./matching.constants";
import { EligibilityCheck, MatchCandidate, MatchResult } from "./matching.types";
import { CERTIFICATIONS, requirementsOf } from "./requirements";
import { workTypeLabel, workTypesOf } from "./work-types";

/** What scoring reads from an announcement; structural, so it takes a TorDoc as-is. */
export type ScorableTor = {
  title: string;
  budgetAmount?: number;
  referencePrice?: number;
  /** What a model read out of the bidding document — the qualifications above all. */
  extraction?: {
    qualifications?: string[];
    referencePrice?: number | null;
    budgetAmount?: number | null;
  } | null;
};

/** Every canonical skill the text implies. */
export function skillsOf(text: string): Set<string> {
  const haystack = text.toLowerCase();
  const skills = new Set<string>();

  for (const [skill, keywords] of Object.entries(SKILL_KEYWORDS)) {
    if (keywords.some((keyword) => haystack.includes(keyword))) skills.add(skill);
  }
  return skills;
}

/** The money the project is worth, from the most authoritative figure on record. */
function projectValue(tor: ScorableTor): number | null {
  return (
    tor.budgetAmount ||
    tor.referencePrice ||
    tor.extraction?.referencePrice ||
    tor.extraction?.budgetAmount ||
    null
  );
}

function threshold(
  requirement: string,
  needed: number | null,
  has: number | null | undefined,
): EligibilityCheck | null {
  if (!needed) return null;
  const status = has === null || has === undefined ? "unknown" : has >= needed ? "pass" : "fail";
  return { requirement, status };
}

/** What the bidding document demands, each checked against the company's own answer. */
function eligibilityOf(tor: ScorableTor, company: MatchCandidate): EligibilityCheck[] {
  const required = requirementsOf(tor.extraction?.qualifications ?? []);
  const checks = [
    threshold(
      `ผลงานไม่น้อยกว่า ${formatBaht(required.minPastContract)}`,
      required.minPastContract,
      company.largestPastContract,
    ),
    threshold(
      `ทุนจดทะเบียนไม่ต่ำกว่า ${formatBaht(required.minRegisteredCapital)}`,
      required.minRegisteredCapital,
      company.registeredCapital,
    ),
    ...required.certifications.map((group): EligibilityCheck => ({
      requirement: group.map((cert) => CERTIFICATIONS[cert].label).join(" หรือ "),
      status: company.certifications === undefined
        ? "unknown"
        : group.some((cert) => company.certifications!.includes(cert))
          ? "pass"
          : "fail",
    })),
  ];
  return checks.filter((check): check is EligibilityCheck => check !== null);
}

const CHECK_WEIGHT = { pass: 1, unknown: 0.5, fail: 0 } as const;

/**
 * How well one company fits one announcement, with the reasons. Three
 * questions, in the order a bidder asks them: is this the kind of contract we
 * do, do we meet what the document demands, and is it the size we want.
 * Deterministic: the same pair always scores the same, and every point traces
 * to a line the reader can see.
 */
export function scoreMatch(tor: ScorableTor, company: MatchCandidate): MatchResult {
  const torTypes = workTypesOf(tor.title);
  const shared = torTypes.filter((type) => company.workTypes.includes(type));
  // Any shared kind of work makes it the company's kind of contract; covering
  // more of what the title names — the maintenance AND the citizen service —
  // makes it a closer one.
  const workFit =
    torTypes.length === 0 || company.workTypes.length === 0
      ? 0.5
      : shared.length
        ? 0.7 + (0.3 * shared.length) / torTypes.length
        : 0;

  const eligibility = eligibilityOf(tor, company);
  const eligibilityFit = eligibility.length
    ? eligibility.reduce((sum, check) => sum + CHECK_WEIGHT[check.status], 0) / eligibility.length
    : 0.7; // no stated barrier is good, not proof
  const failed = eligibility.filter((check) => check.status === "fail");
  const eligible = failed.length
    ? false
    : eligibility.length && eligibility.every((check) => check.status === "pass")
      ? true
      : null;

  const value = projectValue(tor);
  const hasRange = Boolean(company.preferredBudgetMin || company.preferredBudgetMax);
  const inRange =
    value !== null &&
    value >= (company.preferredBudgetMin ?? 0) &&
    value <= (company.preferredBudgetMax || Number.POSITIVE_INFINITY);
  const budgetFit = !hasRange || value === null ? 0.6 : inRange ? 1 : 0.2;

  let score = Math.round(
    100 * (WEIGHTS.work * workFit + WEIGHTS.eligibility * eligibilityFit + WEIGHTS.budget * budgetFit),
  );
  if (failed.length) score = Math.min(score, INELIGIBLE_CEILING);
  if (workFit === 0) score = Math.min(score, OFF_TYPE_CEILING);

  const reasons: string[] = [];
  const gaps: string[] = [];

  if (shared.length) reasons.push(`ตรงกับงานที่บริษัททำ: ${shared.map(workTypeLabel).join(", ")}`);
  else if (workFit === 0) gaps.push(`เป็นงานประเภท ${torTypes.map(workTypeLabel).join(", ")} ซึ่งไม่อยู่ในงานที่บริษัทระบุ`);

  const passed = eligibility.filter((check) => check.status === "pass");
  if (passed.length) reasons.push(`ผ่านเกณฑ์: ${passed.map((check) => check.requirement).join(", ")}`);
  if (failed.length) gaps.push(`ไม่ผ่านเกณฑ์: ${failed.map((check) => check.requirement).join(", ")}`);
  if (eligibility.some((check) => check.status === "unknown")) {
    gaps.push("กรอกผลงาน ทุนจดทะเบียน และใบรับรองในโปรไฟล์ เพื่อเช็คคุณสมบัติให้ครบ");
  }

  if (hasRange && value !== null) {
    if (inRange) reasons.push(`วงเงิน ${formatBaht(value)} อยู่ในช่วงที่บริษัทสนใจ`);
    else gaps.push(`วงเงิน ${formatBaht(value)} อยู่นอกช่วงที่บริษัทสนใจ`);
  }

  return { score, reasons, gaps, eligibility, eligible };
}

/** Ranked best-first, with the matches too weak to suggest dropped. */
export function rankCompanies<T extends MatchCandidate>(
  tor: ScorableTor,
  companies: T[],
): (T & MatchResult)[] {
  return companies
    .map((company) => ({ ...company, ...scoreMatch(tor, company) }))
    .filter((candidate) => candidate.score >= MIN_USEFUL_SCORE)
    .sort((a, b) => b.score - a.score);
}
