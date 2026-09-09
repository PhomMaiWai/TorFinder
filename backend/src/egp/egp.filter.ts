/**
 * e-GP's text search matches loosely — "คอมพิวเตอร์" also hits CT scanners
 * ("เอกซเรย์คอมพิวเตอร์"), "ดิจิทัล" hits X-ray machines, "ระบบ" hits anything.
 * This is the second gate: only announcements that read as software / IT work
 * are imported, which is what this product is about.
 */

/**
 * Software itself, not the infrastructure it runs on. Bare "คอมพิวเตอร์" is
 * deliberately absent — it's the CT-scanner trap — and so are network/hardware
 * words, which belong to IT operations rather than the software work this
 * product is about.
 */
const SOFTWARE_TERMS = [
  "ซอฟต์แวร์",
  "ซอฟท์แวร์",
  "โปรแกรม",
  "แอปพลิเคชัน",
  "แอพพลิเคชัน",
  "เว็บไซต์",
  "เว็บแอป",
  "ระบบสารสนเทศ",
  "ฐานข้อมูล",
  "พัฒนาระบบ",
  "ปรับปรุงระบบ",
  "จัดทำระบบ",
  "ระบบบริหารจัดการ",
  "ระบบบริการ",
  "แพลตฟอร์ม",
  "แดชบอร์ด",
  "ปัญญาประดิษฐ์",
  "คลาวด์",
  "software",
  "application",
  "platform",
  "website",
  "cloud",
  "dashboard",
];

/**
 * Physical goods, buildings and medical equipment that keep tripping the terms
 * above. A hit here drops the announcement outright — "จ้างเหมาซ่อมแซมเครื่อง
 * เอกซเรย์เคลื่อนที่ดิจิทัล" is a device repair, not an IT contract.
 */
const NON_SOFTWARE_TERMS = [
  // Construction & facilities
  "ก่อสร้าง",
  "ปรับปรุงอาคาร",
  "ต่อเติม",
  "ปูพื้น",
  "ทาสี",
  "ถนน",
  "ท่อระบายน้ำ",
  "สะพาน",
  "อาคารเรียน",
  "เช่าอาคาร",
  "เช่าที่ดิน",
  // Facility systems inside a data centre are still building work.
  "ปรับอากาศ",
  "ระบบไฟฟ้า",
  "ลิฟต์",
  "ทำความสะอาด",
  "รักษาความปลอดภัย",
  "กำจัดขยะ",
  "ดูแลต้นไม้",
  // Medical devices & supplies
  "เอกซเรย์",
  "เอ็กซเรย์",
  "เครื่องวัด",
  "โลหิต",
  "ทันตกรรม",
  "เวชภัณฑ์",
  "ครุภัณฑ์การแพทย์",
  "รถพยาบาล",
  "เตียง",
  "ชุดระบบคัดกรอง",
  // Vehicles, consumables, printing
  "ยานพาหนะ",
  "รถยนต์",
  "รถบรรทุก",
  "น้ำมันเชื้อเพลิง",
  "วัสดุ",
  "สติกเกอร์",
  "สติ๊กเกอร์",
  "หมึกพิมพ์",
  "เครื่องพิมพ์",
  "ถ่ายเอกสาร",
  "สิ่งพิมพ์",
  "ป้ายประชาสัมพันธ์",
  "กล้องวงจรปิด",
  "กล้องโทรทัศน์วงจรปิด",
  "ครุภัณฑ์สำนักงาน",
  "เฟอร์นิเจอร์",
  "เครื่องแต่งกาย",
  "อาหาร",
  // Civil works that "พัฒนาระบบ" also describes — water, drainage, boats.
  "บำบัดน้ำเสีย",
  "ระบายน้ำ",
  "ประปา",
  "เดินเรือ",
  "ไฟฟ้าส่องสว่าง",
  "หนังสือพิมพ์",
  // IT operations rather than software: networks, links, machines to keep alive.
  "เครือข่าย",
  "อินเทอร์เน็ต",
  "แม่ข่าย",
  "อุปกรณ์คอมพิวเตอร์",
  "บำรุงรักษาอุปกรณ์",
  "วงจรสื่อสาร",
  // Repairs of physical equipment
  "ซ่อมแซม",
  "อะไหล่",
  "จ้างเหมาบริการบุคคล",
];

/**
 * A purchase ("ซื้อ…") is hardware until proven otherwise: buying a system
 * only counts when the name says software outright, which keeps
 * "ประกวดราคาซื้อระบบสารสนเทศห้องปฏิบัติการ (LIS)" and drops
 * "ซื้อเครื่องเอกซเรย์คอมพิวเตอร์".
 */
const PURCHASE_TERMS = ["ซื้อ", "จัดหาครุภัณฑ์", "ครุภัณฑ์คอมพิวเตอร์"];
const PURCHASABLE_SOFTWARE = [
  "ซอฟต์แวร์",
  "ซอฟท์แวร์",
  "โปรแกรม",
  "ลิขสิทธิ์",
  "ระบบสารสนเทศ",
  "แอปพลิเคชัน",
  "แอพพลิเคชัน",
  "software",
  "license",
];

/**
 * Machines. Buying one is a hardware order even when the name mentions
 * software — a PC bundled with an OEM Windows licence is still a PC. Only the
 * purchase is blocked: maintaining "เครื่องคอมพิวเตอร์แม่ข่าย" is IT work.
 */
const HARDWARE_TERMS = [
  "เครื่องคอมพิวเตอร์",
  "จอแสดงภาพ",
  "โน้ตบุ๊ก",
  "โน๊ตบุ๊ค",
  "แท็บเล็ต",
  "เครื่องสำรองไฟ",
  "ครุภัณฑ์คอมพิวเตอร์",
  "เครื่องสแกน",
  "สแกนเนอร์",
  "อุปกรณ์กระจายสัญญาณ",
];

/** e-GP's own goods category, when enrichment has fetched one. */
const NON_SOFTWARE_CATEGORIES = ["ก่อสร้าง", "ที่ดิน", "ยานพาหนะ", "การแพทย์"];

const contains = (haystack: string, terms: string[]) => terms.some((term) => haystack.includes(term));

export function isSoftwareProject(projectName: string, goodsCategory?: string | null): boolean {
  const name = projectName.toLowerCase();
  const category = (goodsCategory ?? "").toLowerCase();

  if (contains(name, NON_SOFTWARE_TERMS)) return false;
  if (category && contains(category, NON_SOFTWARE_CATEGORIES)) return false;

  if (!contains(name, SOFTWARE_TERMS)) return false;

  if (contains(name, PURCHASE_TERMS)) {
    if (contains(name, HARDWARE_TERMS)) return false;
    if (!contains(name, PURCHASABLE_SOFTWARE)) return false;
  }

  return true;
}
