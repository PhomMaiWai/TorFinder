/**
 * Display labels for values the backend stores in Thai (a TOR's stage, its
 * budget status, a review's status…). The stored value never changes — code
 * compares against it and the database holds it — only what the reader sees
 * follows the language. Labels live under `Values` in messages/*.json.
 */

const KEYS = {
  stage: {
    แผนการจัดซื้อจัดจ้าง: "plan",
    เปิดรับฟังความคิดเห็น: "hearing",
    ประกาศราคากลาง: "referencePrice",
    "ประกาศ TOR": "tor",
    ประกาศผู้ชนะ: "winner",
  },
  budgetStatus: {
    สูงกว่าปกติ: "high",
    ต่ำกว่าปกติ: "low",
    ปกติ: "normal",
    ไม่ประเมิน: "notAssessed",
  },
  reviewStatus: {
    รอตรวจสอบ: "pending",
    อนุมัติ: "approved",
    ปฏิเสธ: "rejected",
  },
  accountStatus: {
    ใช้งาน: "active",
    ระงับ: "suspended",
  },
  /** A field an admin can correct; stored under its English name already. */
  field: {
    title: "title",
    agency: "agency",
    budget: "budget",
    deadline: "deadline",
    daysLeft: "daysLeft",
    tags: "tags",
    stage: "stage",
    summary: "summary",
    budgetStatus: "budgetStatus",
    classification: "classification",
  },
  classification: {
    software: "software",
    "not-software": "notSoftware",
  },
  /**
   * A TOR's tag: the importers tag each record with the portal's announcement
   * type (backend egp/mea/gproc constants). data.go.th sends its own type names,
   * which pass through as published.
   */
  tag: {
    "ร่างขอบเขตของงาน (TOR)": "draftTor",
    ประกาศเชิญชวน: "invitation",
    "ประกาศรายชื่อผู้ชนะการเสนอราคา / ประกาศรายชื่อผู้ได้รับการคัดเลือก": "winnersList",
    ประกาศรับฟังความคิดเห็น: "hearing",
    ประกาศข่าวจัดซื้อจัดจ้าง: "procurementNews",
    ประกาศผู้ชนะการเสนอราคา: "winner",
    ประกาศผู้ชนะ: "winner",
    แผนการจัดซื้อจัดจ้าง: "plan",
    ประกาศราคากลาง: "referencePrice",
    ร่างเอกสารประกวดราคา: "draftBidDocuments",
    ยกเลิกประกาศเชิญชวน: "invitationCancelled",
    จัดซื้อจัดจ้าง: "procurement",
    ทั่วไป: "general",
  },
  companySize: {
    "1-10 คน": "s1to10",
    "11-50 คน": "s11to50",
    "51-200 คน": "s51to200",
    "200+ คน": "s200plus",
  },
} as const;

export type ValueKind = keyof typeof KEYS;

/** Whatever `useTranslations("Values")` or `getTranslations("Values")` returns. */
type Translate = (key: string) => string;

/**
 * The reader's label for a stored value. "ไม่ระบุ" (unknown) reads as such in
 * every kind; a value this table doesn't know is shown as stored rather than
 * hidden, so new backend values still appear.
 */
export function valueLabel(t: Translate, kind: ValueKind, value: string | null | undefined): string {
  if (value == null || value === "") return "";
  if (value === "ไม่ระบุ") return t("unknown");
  const key = (KEYS[kind] as Record<string, string>)[value];
  return key ? t(`${kind}.${key}`) : value;
}

/** A free-text value (a budget, a date) as shown, with the stored "ไม่ระบุ" read in the reader's language. */
export function displayValue(t: Translate, value: string): string {
  return value === "ไม่ระบุ" ? t("unknown") : value;
}
