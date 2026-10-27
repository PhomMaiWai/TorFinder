import { foldThaiDigits } from "../tor/tor-normalize";

/** "ISO 27001", "ISO/IEC 27001", "IEC 27001" — however a document spells the body. */
function iso(standard: string): RegExp {
  return new RegExp(`(?:ISO|IEC)[\\s/]*(?:IEC\\s*)?${standard}(?!\\d)`, "i");
}

const CMMI_LEVEL_5 = /CMMI.{0,25}?(?:Level|ระดับ|ML|L)\s*5/i;

/**
 * The certifications a TOR asks for that a company can simply have or not.
 * Each is matched on the wording a bidding document uses for it.
 */
export const CERTIFICATIONS = {
  iso29110: { label: "ISO/IEC 29110", pattern: iso("29110") },
  // A CMMI requirement without a level, or at level 3, is met by level 3 or 5 — see requirementsOf.
  cmmi3: { label: "CMMI Level 3", pattern: /CMMI(?!.{0,25}?(?:Level|ระดับ|ML|L)\s*5)/i },
  cmmi5: { label: "CMMI Level 5", pattern: CMMI_LEVEL_5 },
  iso12207: { label: "ISO/IEC 12207", pattern: iso("12207") },
  iso25010: { label: "ISO/IEC 25010", pattern: iso("25010") },
  iso27001: { label: "ISO/IEC 27001", pattern: iso("27001") },
  iso27701: { label: "ISO/IEC 27701", pattern: iso("27701") },
  iso27017: { label: "ISO/IEC 27017", pattern: iso("27017") },
  iso27018: { label: "ISO/IEC 27018", pattern: iso("27018") },
  pcidss: { label: "PCI DSS", pattern: /PCI[\s-]*DSS/i },
  csastar: { label: "CSA STAR", pattern: /CSA\s*STAR/i },
  iso15408: { label: "ISO/IEC 15408", pattern: /(?:ISO|IEC)[\s/]*(?:IEC\s*)?15408|Common\s*Criteria/i },
  iso20000: { label: "ISO/IEC 20000-1", pattern: iso("20000") },
  iso22301: { label: "ISO 22301", pattern: iso("22301") },
  tia942: { label: "TIA-942", pattern: /TIA[\s-]*942/i },
  iso9001: { label: "ISO 9001", pattern: iso("9001") },
  iso14001: { label: "ISO 14001", pattern: iso("14001") },
  iso42001: { label: "ISO/IEC 42001", pattern: iso("42001") },
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
    for (const group of lineGroups) {
      // A higher CMMI maturity level meets a lower one's requirement.
      const satisfiedBy = group.includes("cmmi3") && !group.includes("cmmi5") ? [...group, "cmmi5" as const] : group;
      groups.set(satisfiedBy.join("|"), satisfiedBy);
    }
  }

  return {
    minPastContract: largest(lines, EXPERIENCE),
    minRegisteredCapital: largest(lines, CAPITAL),
    certifications: [...groups.values()],
  };
}
