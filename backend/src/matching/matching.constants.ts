/**
 * Canonical skills, each with the words that imply it in a TOR title or in a
 * company's stated specialty. Both sides are reduced to this vocabulary so the
 * two are comparable at all — "พัฒนาเว็บไซต์" and "Web Application" are the
 * same capability written two ways.
 */
export const SKILL_KEYWORDS: Record<string, string[]> = {
  web: ["เว็บ", "website", "web", "frontend", "next.js", "react"],
  mobile: ["แอปพลิเคชัน", "แอพ", "มือถือ", "mobile", "ios", "android", "flutter"],
  cloud: ["คลาวด์", "cloud", "kubernetes", "devops", "container", "แม่ข่าย"],
  data: ["ฐานข้อมูล", "ข้อมูล", "data", "etl", "dashboard", "แดชบอร์ด", "bi"],
  ai: ["ปัญญาประดิษฐ์", "ai", "machine learning", "ml", "ocr", "vision"],
  security: ["ความปลอดภัย", "ไซเบอร์", "security", "cyber", "iso 27001"],
  gis: ["ภูมิสารสนเทศ", "แผนที่", "gis", "map"],
  iot: ["เซ็นเซอร์", "iot", "sensor"],
  erp: ["บริหารจัดการ", "สารบรรณ", "erp", "workflow", "การเงิน", "งบประมาณ", "บุคลากร"],
  healthcare: ["โรงพยาบาล", "เวชระเบียน", "สุขภาพ", "his", "emr", "hl7"],
  integration: ["เชื่อมโยง", "บูรณาการ", "api", "integration"],
};

/**
 * How large a project each company size is credible for, in baht. Above the
 * ceiling the score is discounted rather than zeroed: a small firm can still
 * win a large contract, it is just a weaker match.
 */
export const SIZE_CEILING: Record<string, number> = {
  เล็ก: 5_000_000,
  กลาง: 20_000_000,
  ใหญ่: Number.POSITIVE_INFINITY,
};

/** Weights sum to 1: the score stays a plain percentage of a perfect fit. */
export const WEIGHTS = {
  /** Does the company do this kind of work at all? Everything else is secondary. */
  skills: 0.65,
  /** Can a company that size carry a project this big? */
  size: 0.25,
  /** Same words in the title as in the specialty — a tie-breaker, nothing more. */
  wording: 0.1,
} as const;

/** Below this, a match is too weak to be worth showing as a suggestion. */
export const MIN_USEFUL_SCORE = 40;
