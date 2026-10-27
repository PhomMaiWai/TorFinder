/**
 * What a reader calls the files e-GP's generator names — the same names turn
 * up in MEA's bundles and the national e-GP's. Order is display order: the
 * documents about this project first, the standard forms after.
 */
const KNOWN_FILES: [RegExp, string][] = [
  [/^tor[_\s.-]|[\s._-]tor[\s._-]|^\d+\.?\s*tor\b/i, "ขอบเขตของงาน (TOR)"],
  [/^doc_/i, "เอกสารประกวดราคา"],
  [/^annoudoc_/i, "ประกาศเชิญชวน"],
  [/^boq|pricebuild/i, "ใบแจ้งปริมาณงานและราคา (BOQ)"],
  [/^quotation/i, "แบบใบเสนอราคา"],
  [/^contract/i, "แบบสัญญา"],
  [/^bidding\s*no(l)?tice/i, "แบบประกาศเชิญชวน"],
  [/^document\s*part\s*1/i, "แบบบัญชีเอกสารส่วนที่ 1"],
  [/^document\s*part\s*2/i, "แบบบัญชีเอกสารส่วนที่ 2"],
  [/^definition/i, "บทนิยาม"],
  [/^bid\s*bond/i, "แบบหนังสือค้ำประกันซอง"],
  [/^performance\s*bond/i, "แบบหนังสือค้ำประกันสัญญา"],
  [/^advance\s*payment\s*bond/i, "แบบหนังสือค้ำประกันเงินรับล่วงหน้า"],
  [/^retention\s*bond/i, "แบบหนังสือค้ำประกันผลงาน"],
  [/^domestic\s*material/i, "แผนการใช้พัสดุที่ผลิตภายในประเทศ"],
  [/^performance/i, "หลักเกณฑ์การประเมินผลงาน"],
  [/^action_plan/i, "แผนการดำเนินงาน"],
];

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** A readable name for a file out of a bundle; an unknown one keeps its own name. */
export function documentLabel(path: string): string {
  const file = baseName(path);
  return KNOWN_FILES.find(([pattern]) => pattern.test(file))?.[1] ?? file.replace(/\.[^.]+$/, "");
}

/** Sorts files the way a reader wants them: known documents in KNOWN_FILES order, the rest after. */
export function documentRank(path: string): number {
  const file = baseName(path);
  const at = KNOWN_FILES.findIndex(([pattern]) => pattern.test(file));
  return at === -1 ? KNOWN_FILES.length : at;
}
