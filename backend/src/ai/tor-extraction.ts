import { TorExtraction } from "./ai.types";

/** Longest field the UI will ever show; anything beyond is the model rambling. */
const MAX_TEXT = 5_000;
const MAX_LIST_ITEMS = 30;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_TEXT) : null;
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item))
    .filter((item): item is string => item !== null)
    .slice(0, MAX_LIST_ITEMS);
}

/**
 * The eligibility every Thai public bid repeats word for word — legal capacity,
 * not bankrupt, not blacklisted, no collusion, no immunity, the joint-venture
 * rules, the bank-deposit and credit-line alternatives. It says nothing about
 * this project, so it is folded into one line however the model wrote it out.
 */
const REGULATION_BOILERPLATE =
  /ความสามารถตามกฎหมาย|บุคคลล้มละลาย|เลิกกิจการ|ถูกระงับการยื่นข้อเสนอ|ผู้ทิ้งงาน|ลักษณะต้องห้าม|ผลประโยชน์ร่วมกัน|ขัดขวาง\s*การแข่งขัน|เอกสิทธิ์หรือความคุ้มกัน|กิจการร่วมค้า|ลงทะเบียน.{0,40}e\s*-?\s*GP|บัญชีเงินฝาก|วงเงินสินเชื่อ|บัญชีรายรับรายจ่าย|ผ่านบัญชีธนาคาร|ค่าซื้อเอกสารประกวดราคา/;
const REGULATION_SUMMARY =
  "คุณสมบัติทั่วไปตามระเบียบพัสดุภาครัฐ (เช่น ไม่เป็นบุคคลล้มละลาย ไม่เป็นผู้ทิ้งงาน ลงทะเบียน e-GP)";
/** A pointer elsewhere ("ตามที่เอกสาร…กำหนด") is not a requirement anyone can check. */
const POINTER_ONLY = /^ผู้ยื่นข้อเสนอ(จะ)?ต้องมีคุณสมบัติ(ให้)?เป็นไปตาม.{0,60}กำหนด\.?$/;

function sharpenQualifications(items: string[]): string[] {
  const specific = items.filter(
    (item) => !REGULATION_BOILERPLATE.test(item) && !POINTER_ONLY.test(item) && item !== REGULATION_SUMMARY,
  );
  const hadGeneral = specific.length < items.length && items.some((item) => !POINTER_ONLY.test(item));
  return hadGeneral ? [REGULATION_SUMMARY, ...specific] : specific;
}

const INSTALMENT = /^งวด(?:ที่)?\s*(\d+)\s*[:：.-]?\s*(.+)$/;
const THAI_MONTH =
  "(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)";
/** What differs between otherwise identical monthly instalments: the month and its day count. */
const MONTHLY_DETAIL = new RegExp(
  `\\s*(?:ประจำ)?เดือน\\s*${THAI_MONTH}\\s*(?:พ\\.ศ\\.\\s*)?[\\d๐-๙]{4}|\\s*ภายใน\\s*[\\d๐-๙]+\\s*วัน`,
  "g",
);

/**
 * A twelve-month service contract is paid in twelve instalments that differ
 * only by month, and twelve near-identical lines bury the one that differs.
 * Consecutive instalments with the same terms become one range.
 */
function mergeInstalments(items: string[]): string[] {
  const merged: string[] = [];
  let run: { first: number; last: number; terms: string; original: string; monthly: boolean } | null = null;

  const flush = () => {
    if (!run) return;
    merged.push(
      run.first === run.last
        ? run.original
        : `งวดที่ ${run.first}–${run.last}: งวดละ ${run.terms}${run.monthly ? " (รายเดือน)" : ""}`,
    );
    run = null;
  };

  for (const item of items) {
    const match = INSTALMENT.exec(item);
    if (!match) {
      flush();
      merged.push(item);
      continue;
    }
    const number = Number(match[1]);
    const terms = match[2].replace(MONTHLY_DETAIL, "").replace(/\s+/g, " ").trim();
    if (run && run.terms === terms && number === run.last + 1) {
      run.last = number;
      continue;
    }
    flush();
    run = { first: number, last: number, terms, original: item, monthly: terms !== match[2].trim() };
  }
  flush();
  return merged;
}

/** ISO date only, and only one the calendar actually has. */
function isoDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : raw;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Second gate after Vertex's own schema check. The schema guarantees the shape,
 * not the content: a model can still answer with an empty string, a 90 that
 * meant 0.9, or a Buddhist year it forgot to convert. Nothing reaches the
 * database until it has passed through here.
 */
export function parseExtraction(raw: unknown): TorExtraction {
  const value = (raw ?? {}) as Record<string, unknown>;

  const confidence = typeof value.confidence === "number" ? value.confidence : 0;

  return {
    scope: text(value.scope),
    objectives: list(value.objectives),
    qualifications: sharpenQualifications(list(value.qualifications)),
    deliverables: list(value.deliverables),
    budgetAmount: positiveNumber(value.budgetAmount),
    referencePrice: positiveNumber(value.referencePrice),
    contractPeriod: text(value.contractPeriod),
    // A year past 2100 is a Buddhist year that escaped conversion — dropping it
    // is better than showing a deadline 543 years out.
    deadline: dropImplausibleYear(isoDate(value.deadline)),
    evaluationCriteria: text(value.evaluationCriteria),
    paymentTerms: mergeInstalments(list(value.paymentTerms)),
    bidSecurity: text(value.bidSecurity),
    penalty: text(value.penalty),
    warrantyPeriod: text(value.warrantyPeriod),
    contact: text(value.contact),
    // Models sometimes answer 90 for "90%"; clamped so it stays comparable.
    confidence: Math.min(1, Math.max(0, confidence > 1 ? confidence / 100 : confidence)),
  };
}

function dropImplausibleYear(date: string | null): string | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return year >= 2000 && year <= 2100 ? date : null;
}

/** An extraction with nothing usable in it isn't worth storing. */
export function isUseful(extraction: TorExtraction): boolean {
  return Boolean(
    extraction.scope ||
      extraction.objectives.length ||
      extraction.qualifications.length ||
      extraction.deliverables.length ||
      extraction.budgetAmount ||
      extraction.referencePrice ||
      extraction.deadline,
  );
}
