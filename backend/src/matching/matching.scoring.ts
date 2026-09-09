import { MIN_USEFUL_SCORE, SIZE_CEILING, SKILL_KEYWORDS, WEIGHTS } from "./matching.constants";
import { MatchCandidate, MatchResult } from "./matching.types";

/** What scoring reads from an announcement; kept structural so it takes a TorDoc as-is. */
type ScorableTor = {
  title: string;
  summary: string;
  tags: string[];
  budget: string;
};

const SKILL_LABELS: Record<string, string> = {
  web: "เว็บแอปพลิเคชัน",
  mobile: "แอปพลิเคชันมือถือ",
  cloud: "คลาวด์ / โครงสร้างพื้นฐาน",
  data: "ข้อมูลและแดชบอร์ด",
  ai: "ปัญญาประดิษฐ์",
  security: "ความปลอดภัยสารสนเทศ",
  gis: "ภูมิสารสนเทศ",
  iot: "IoT / เซ็นเซอร์",
  erp: "ระบบบริหารจัดการองค์กร",
  healthcare: "ระบบสารสนเทศสุขภาพ",
  integration: "การเชื่อมโยงระบบ",
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

/** Budget in baht, or null when the announcement doesn't state one. */
export function budgetOf(budget: string): number | null {
  const digits = budget.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

/**
 * How well one company fits one announcement, as a percentage with the reasons
 * that produced it. Deterministic on purpose: the same pair always scores the
 * same, and every point is traceable to a rule a person can argue with.
 */
export function scoreMatch(tor: ScorableTor, company: MatchCandidate): MatchResult {
  const needed = skillsOf(`${tor.title} ${tor.summary} ${tor.tags.join(" ")}`);
  const offered = skillsOf(company.specialty);

  const matched = [...needed].filter((skill) => offered.has(skill));
  const missing = [...needed].filter((skill) => !offered.has(skill));

  // An announcement whose wording implies no particular skill can't discriminate
  // between companies, so it scores neutral instead of punishing everyone.
  const skillFit = needed.size === 0 ? 0.5 : matched.length / needed.size;

  const budget = budgetOf(tor.budget);
  const ceiling = SIZE_CEILING[company.size] ?? SIZE_CEILING["กลาง"];
  const sizeFit = budget === null ? 0.5 : budget <= ceiling ? 1 : ceiling / budget;

  // Direct word overlap between the specialty and the title — catches domain
  // wording the skill vocabulary doesn't cover yet.
  const wordingFit = wordOverlap(company.specialty, tor.title);

  const score = Math.round(
    100 * (WEIGHTS.skills * skillFit + WEIGHTS.size * sizeFit + WEIGHTS.wording * wordingFit),
  );

  const reasons: string[] = [];
  const gaps: string[] = [];

  if (matched.length) {
    reasons.push(`ตรงกับความเชี่ยวชาญ: ${matched.map(labelFor).join(", ")}`);
  }
  if (budget !== null && budget <= ceiling) {
    reasons.push(`ขนาดบริษัท (${company.size}) สอดคล้องกับวงเงินโครงการ`);
  }
  if (missing.length) {
    gaps.push(`ยังไม่พบประสบการณ์ด้าน: ${missing.map(labelFor).join(", ")}`);
  }
  if (budget !== null && budget > ceiling) {
    gaps.push(`วงเงินโครงการสูงกว่าขนาดงานที่บริษัทขนาด${company.size}มักรับ`);
  }

  return { score, reasons, gaps };
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

function labelFor(skill: string): string {
  return SKILL_LABELS[skill] ?? skill;
}

/** Share of the specialty's words that also appear in the title, 0-1. */
function wordOverlap(specialty: string, title: string): number {
  const words = specialty
    .toLowerCase()
    .split(/[\s/,·]+/)
    .filter((word) => word.length > 2);
  if (words.length === 0) return 0;

  const haystack = title.toLowerCase();
  return words.filter((word) => haystack.includes(word)).length / words.length;
}
