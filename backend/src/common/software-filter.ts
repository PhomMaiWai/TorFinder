/**
 * Every portal this app imports from searches text loosely — "คอมพิวเตอร์" also
 * hits CT scanners ("เอกซเรย์คอมพิวเตอร์"), "ดิจิทัล" hits X-ray machines,
 * "ระบบ" hits anything. This is the second gate, shared by every source: only
 * announcements that read as software / IT work are imported, which is what
 * this product is about.
 *
 * The keywords a portal is searched *with* live here too, because they only
 * decide what gets considered — what is actually imported is decided below,
 * and the two are useless apart.
 */

/**
 * One search runs per keyword. Deliberately broader than the terms below: a
 * portal's index stems and truncates, so casting wide here and judging
 * precisely there beats trying to write one query that does both.
 */
export const SOFTWARE_SEARCH_KEYWORDS = [
  "ซอฟต์แวร์",
  "ระบบสารสนเทศ",
  "คอมพิวเตอร์",
  "พัฒนาระบบ",
  "เทคโนโลยีสารสนเทศ",
  "ดิจิทัล",
  "เว็บไซต์",
  "ฐานข้อมูล",
  // Names that carry none of the words above — "จ้างเหมาบริการดูแลรักษาโปรแกรม
  // ระบบ …" — are otherwise never seen, however clearly the filter accepts them.
  "โปรแกรม",
  "แอปพลิเคชัน",
  "แพลตฟอร์ม",
  "ระบบบริหารจัดการ",
  "ปรับปรุงระบบ",
  "จัดทำระบบ",
  "ปัญญาประดิษฐ์",
  "คลาวด์",
];

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
  "เทคโนโลยีสารสนเทศ",
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
  "helpdesk",
  "help desk",
  "service desk",
  "ห้องสมุดออนไลน์",
  "e-library",
  "e-learning",
  "e-service",
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
  "ดับเพลิง",
  "จ่ายไฟฟ้า",
  "สายดิน",
  "ตู้น้ำดื่ม",
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
  // Spare parts for physical equipment
  "อะไหล่",
  "จ้างเหมาบริการบุคคล",
];

/**
 * IT operations rather than software: networks, links, machines to keep alive.
 * Out of scope on their own, but Bangkok tenders its application support as
 * "บำรุงรักษาระบบเครือข่ายและโปรแกรมประยุกต์" — one contract for both — and a
 * name that says application software outright is software work.
 */
const IT_OPERATIONS_TERMS = [
  // Repairs — of buildings and machines, unless the name says it's software.
  "ซ่อมแซม",
  "เครือข่าย",
  "อินเทอร์เน็ต",
  "แม่ข่าย",
  "อุปกรณ์คอมพิวเตอร์",
  "บำรุงรักษาอุปกรณ์",
  "วงจรสื่อสาร",
];
const APPLICATION_TERMS = [
  "โปรแกรมประยุกต์",
  "ชุดโปรแกรม",
  "ซอฟต์แวร์",
  "ซอฟท์แวร์",
  "แอปพลิเคชัน",
  "แอพพลิเคชัน",
  "software",
  "application",
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
  "helpdesk",
  "help desk",
  "service desk",
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

/**
 * Computers and the networks between them — machines, servers, notebooks,
 * peripherals, their maintenance. An IT vendor bids on these as readily as on
 * software, so they count, unless the name says the computer is part of
 * something else (a CT scanner, a medical device) or is only its consumables.
 */
const COMPUTER_TERMS = ["คอมพิวเตอร์", "เครื่องแม่ข่าย", "server"];
const NOT_IT_HARDWARE = [
  "วัสดุ",
  "หมึก",
  "ดรัม",
  "เอกซเรย์",
  "เอ็กซเรย์",
  "การแพทย์",
  "เครื่องตรวจ",
  "กระจกตา",
  "ทันตกรรม",
  "สติกเกอร์",
  "สติ๊กเกอร์",
];

/**
 * The agency picks the vendor itself (วิธีเฉพาะเจาะจง): the announcement is a
 * record of a purchase already arranged, not something anyone else can bid on.
 */
const DIRECT_PURCHASE = "เฉพาะเจาะจง";

/** The portal's own category for the work, when it publishes one. */
const NON_SOFTWARE_CATEGORIES = ["ก่อสร้าง", "ที่ดิน", "ยานพาหนะ", "การแพทย์"];

const contains = (haystack: string, terms: string[]) => terms.some((term) => haystack.includes(term));

/**
 * `category` is whatever the source calls its own classification — e-GP's goods
 * category, กรมบัญชีกลาง's `typ_name`. Optional: the project name alone decides
 * when a source publishes none.
 */
export function isSoftwareProject(projectName: string, category?: string | null): boolean {
  const name = projectName.toLowerCase();
  const ownCategory = (category ?? "").toLowerCase();

  if (name.includes(DIRECT_PURCHASE)) return false;
  if (contains(name, COMPUTER_TERMS) && !contains(name, NOT_IT_HARDWARE)) return true;

  if (contains(name, NON_SOFTWARE_TERMS)) return false;
  if (contains(name, IT_OPERATIONS_TERMS) && !contains(name, APPLICATION_TERMS)) return false;
  if (ownCategory && contains(ownCategory, NON_SOFTWARE_CATEGORIES)) return false;

  if (!contains(name, SOFTWARE_TERMS)) return false;

  if (contains(name, PURCHASE_TERMS)) {
    if (contains(name, HARDWARE_TERMS)) return false;
    if (!contains(name, PURCHASABLE_SOFTWARE)) return false;
  }

  return true;
}
