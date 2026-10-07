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

/** Weights sum to 1: the score stays a plain percentage of a perfect fit. */
export const WEIGHTS = {
  /** Does the company do this kind of contract at all? Everything else is secondary. */
  work: 0.5,
  /** Does it meet what the bidding document demands of a bidder? */
  eligibility: 0.35,
  /** Is the project the size the company wants to bid on? */
  budget: 0.15,
} as const;

/**
 * Eligibility when the document states no checkable requirement: no barrier is
 * a good sign, not proof — the same neutral value as an unknown budget.
 */
export const NO_STATED_REQUIREMENTS = 0.6;

/** A company that fails a stated requirement cannot win, whatever else fits. */
export const INELIGIBLE_CEILING = 40;
/** Nor is a contract of a kind the company doesn't do much of an opportunity. */
export const OFF_TYPE_CEILING = 35;

/** Below this, a match is too weak to be worth showing as a suggestion. */
export const MIN_USEFUL_SCORE = 40;
