import { foldThaiDigits } from "../tor/tor-normalize";

/**
 * The certifications a TOR asks for that a company can simply have or not.
 * Each is matched on the wording a bidding document uses for it.
 */
export const CERTIFICATIONS = {
  iso9001: { label: "ISO 9001", pattern: /ISO\s*9001/i },
  iso14001: { label: "ISO 14001", pattern: /ISO\s*14001/i },
  iso27001: { label: "ISO/IEC 27001", pattern: /(ISO|IEC)[\s/]*(IEC\s*)?27001/i },
  iso20000: { label: "ISO/IEC 20000", pattern: /(ISO|IEC)[\s/]*(IEC\s*)?20000/i },
  cmmi: { label: "CMMI", pattern: /CMMI/i },
  dealer: { label: "หนังสือแต่งตั้งตัวแทนจำหน่ายจากผู้ผลิต", pattern: /แต่งตั้ง.{0,20}ตัวแทนจำหน่าย|ตัวแทนจำหน่าย.{0,30}ผู้ผลิต/ },
} as const satisfies Record<string, { label: string; pattern: RegExp }>;

export type Certification = keyof typeof CERTIFICATIONS;
export const CERTIFICATION_KEYS = Object.keys(CERTIFICATIONS) as Certification[];

/** What a TOR demands of a bidder that a company profile can be checked against. */
export type TorRequirements = {
  /** Smallest past contract value accepted as relevant experience, baht. */
  minPastContract: number | null;
  /** Smallest registered capital accepted, baht. */
  minRegisteredCapital: number | null;
  /**
   * Each inner list is one requirement any of whose certifications satisfies
   * it — "ISO 9001 และ/หรือ ISO 14001" is one requirement, not two.
   */
  certifications: Certification[][];
};

/** "A หรือ B", "A และ/หรือ B" — alternatives, not a list of musts. */
const ALTERNATIVES = /หรือ|\bor\b/;

const AT_LEAST = "(?:ไม่น้อยกว่า|ไม่ต่ำกว่า|ขั้นต่ำ|อย่างน้อย)";
const AMOUNT = "([\\d,]+(?:\\.\\d+)?)\\s*(ล้าน)?\\s*บาท";
const EXPERIENCE = new RegExp(`ผลงาน.{0,250}?${AT_LEAST}\\s*(?:เป็นเงิน|มูลค่า|วงเงิน)?\\s*${AMOUNT}`);
const CAPITAL = new RegExp(`ทุนจดทะเบียน.{0,120}?${AT_LEAST}\\s*${AMOUNT}`);

function baht(digits: string, million: string | undefined): number | null {
  const value = Number(digits.replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return million ? value * 1_000_000 : value;
}

/** The largest threshold any line states — a TOR that asks twice means the stricter one. */
function largest(lines: string[], pattern: RegExp): number | null {
  const values = lines
    .map((line) => pattern.exec(line))
    .map((match) => (match ? baht(match[1], match[2]) : null))
    .filter((value): value is number => value !== null);
  return values.length ? Math.max(...values) : null;
}

/**
 * Reads the checkable thresholds out of the qualifications a model extracted
 * from the bidding document. Deterministic on purpose: the same text always
 * gives the same verdict, and every number can be traced to a line a person
 * can read on the detail page.
 */
export function requirementsOf(qualifications: string[]): TorRequirements {
  const lines = qualifications.map((line) => foldThaiDigits(line).replace(/\s+/g, " "));

  const groups = new Map<string, Certification[]>();
  for (const line of lines) {
    const named = CERTIFICATION_KEYS.filter((key) => CERTIFICATIONS[key].pattern.test(line));
    if (named.length === 0) continue;
    // Certifications named together on a line with an "or" are alternatives;
    // otherwise each one is required on its own.
    const lineGroups = named.length > 1 && ALTERNATIVES.test(line) ? [named] : named.map((key) => [key]);
    for (const group of lineGroups) groups.set(group.join("|"), group);
  }

  return {
    minPastContract: largest(lines, EXPERIENCE),
    minRegisteredCapital: largest(lines, CAPITAL),
    certifications: [...groups.values()],
  };
}
