/**
 * The AI-extraction half of the admin's TOR edit form. Inputs are named
 * `ex_<field>`; the section adds a hidden `ex_present` only when the record has
 * an extraction to review, so a form without one sends nothing.
 */

/** One line per item in the form; an array in the backend. */
export const EXTRACTION_LIST_FIELDS = ["objectives", "qualifications", "deliverables", "paymentTerms"] as const;

/** Baht amounts, typed with or without thousands separators. */
export const EXTRACTION_MONEY_FIELDS = ["budgetAmount", "referencePrice"] as const;

/** Free text; empty clears the field. */
export const EXTRACTION_TEXT_FIELDS = [
  "scope",
  "contractPeriod",
  "evaluationCriteria",
  "bidSecurity",
  "penalty",
  "warrantyPeriod",
  "contact",
  "deadline",
  "deadlineTime",
  "feedbackDeadline",
] as const;

export type ExtractionPayload = Record<string, string | string[] | number | boolean | null>;

/**
 * What the extraction section of the form asks the backend to store, or the
 * reason it can't be sent. `null` when the form had no extraction section.
 */
export function parseExtractionFormData(formData: FormData): { payload: ExtractionPayload } | { error: string } | null {
  if (!formData.has("ex_present")) return null;
  const text = (field: string) => String(formData.get(`ex_${field}`) ?? "").trim();
  const payload: ExtractionPayload = {};

  for (const field of EXTRACTION_TEXT_FIELDS) payload[field] = text(field) || null;

  for (const field of EXTRACTION_LIST_FIELDS) {
    payload[field] = text(field)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  for (const field of EXTRACTION_MONEY_FIELDS) {
    const raw = text(field).replace(/[,\s฿]|บาท/g, "");
    if (!raw) {
      payload[field] = null;
      continue;
    }
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) return { error: "จำนวนเงินต้องเป็นตัวเลขที่ไม่ติดลบ" };
    payload[field] = amount;
  }

  payload.reviewed = formData.get("ex_reviewed") === "on";
  return { payload };
}
