/**
 * The kinds of public-sector IT work a company takes on, in the words a TOR's
 * title uses for them. This is what a company is matched on — not a list of
 * technologies: an agency buys "maintenance of the permit system", and the
 * question is whether the company does that kind of contract.
 */
export const WORK_TYPES = {
  // Software
  development: {
    label: "พัฒนาระบบ / ซอฟต์แวร์ตามสั่ง",
    terms: ["พัฒนาระบบ", "พัฒนาโปรแกรม", "จัดทำระบบ", "ปรับปรุงระบบ", "ออกแบบระบบ", "จ้างพัฒนา", "แพลตฟอร์ม"],
  },
  web: {
    label: "เว็บไซต์ / เว็บพอร์ทัล",
    terms: ["เว็บไซต์", "เว็บพอร์ทัล", "เว็บแอป", "website", "portal"],
  },
  mobile: {
    label: "แอปพลิเคชันมือถือ",
    terms: ["แอปพลิเคชันบนมือถือ", "แอปพลิเคชันมือถือ", "โมบาย", "mobile", "สมาร์ทโฟน", "ios", "android"],
  },
  erp: {
    label: "ระบบงานภายในองค์กร (ERP / HR / การเงิน / สารบรรณ)",
    terms: ["ระบบบริหารจัดการ", "erp", "สารบรรณ", "ทรัพยากรบุคคล", "บุคลากร", "การเงิน", "การคลัง", "บัญชี", "งบประมาณ", "พัสดุ", "สำนักงานอัตโนมัติ"],
  },
  eservice: {
    label: "ระบบบริการประชาชน / e-Service",
    terms: ["บริการประชาชน", "e-service", "ศูนย์รับคำขอ", "ยื่นคำขอ", "ศูนย์บริการ", "ชำระภาษี", "รับเงิน", "ออนไลน์"],
  },
  // Services
  maintenance: {
    label: "บำรุงรักษาระบบ / MA",
    terms: ["บำรุงรักษา", "ดูแลระบบ", "ดูแลรักษา", "ซ่อมแซม", "แก้ไขระบบ"],
  },
  helpdesk: {
    label: "Helpdesk / IT Support / ผู้ดูแลระบบ",
    terms: ["helpdesk", "help desk", "service desk", "it support", "ผู้ดูแลระบบ", "สนับสนุนการใช้งาน", "จ้างเหมาบริการบุคลากร"],
  },
  license: {
    label: "ลิขสิทธิ์ / สิทธิ์การใช้งานซอฟต์แวร์",
    terms: ["ลิขสิทธิ์", "สิทธิ์การใช้งาน", "สิทธิการใช้งาน", "license", "subscription", "เช่าใช้"],
  },
  consulting: {
    label: "ที่ปรึกษา / ศึกษา / แผนแม่บท",
    terms: ["ที่ปรึกษา", "ศึกษา", "แผนแม่บท", "สำรวจความ"],
  },
  // Hardware & infrastructure
  hardware: {
    label: "จัดหาคอมพิวเตอร์ / โน้ตบุ๊ก",
    terms: ["ครุภัณฑ์คอมพิวเตอร์", "เครื่องคอมพิวเตอร์", "จัดซื้อคอมพิวเตอร์", "ซื้อคอมพิวเตอร์", "เช่าเครื่องคอมพิวเตอร์", "คอมพิวเตอร์พกพา", "โน้ตบุ๊ก", "แท็บเล็ต"],
  },
  peripherals: {
    label: "เครื่องพิมพ์ / สแกนเนอร์ / อุปกรณ์ต่อพ่วง",
    terms: ["เครื่องพิมพ์", "สแกนเนอร์", "จอแสดงภาพ", "เครื่องสำรองไฟ", "ups", "อุปกรณ์คอมพิวเตอร์", "interactive board", "ต่อพ่วง"],
  },
  network: {
    label: "ระบบเครือข่าย / Wi-Fi / อินเทอร์เน็ต",
    terms: ["เครือข่าย", "อินเทอร์เน็ต", "ไร้สาย", "wi-fi", "wifi", "lan", "วงจรสื่อสาร"],
  },
  datacenter: {
    label: "ศูนย์ข้อมูล / Server / คลาวด์",
    terms: ["ศูนย์ข้อมูล", "data center", "แม่ข่าย", "server", "คลาวด์", "cloud", "storage", "จัดเก็บข้อมูล"],
  },
  security: {
    label: "ความมั่นคงปลอดภัยไซเบอร์",
    terms: ["ความมั่นคงปลอดภัย", "ไซเบอร์", "ช่องโหว่", "ป้องกันไวรัส", "ไฟร์วอลล์", "firewall", "cyber", "security"],
  },
  // Domains
  data: {
    label: "ฐานข้อมูล / Data / Dashboard",
    terms: ["ฐานข้อมูล", "คลังข้อมูล", "ข้อมูลขนาดใหญ่", "แดชบอร์ด", "dashboard", "วิเคราะห์ข้อมูล", "big data", "sql", "data"],
  },
  ai: {
    label: "AI / ระบบอัจฉริยะ",
    terms: ["ปัญญาประดิษฐ์", "อัจฉริยะ", "machine learning", "ocr", "วิเคราะห์ภาพ", "chatbot", "agentic"],
  },
  gis: {
    label: "ภูมิสารสนเทศ / แผนที่ (GIS)",
    terms: ["ภูมิสารสนเทศ", "gis", "แผนที่"],
  },
  health: {
    label: "ระบบโรงพยาบาล / สาธารณสุข",
    terms: ["โรงพยาบาล", "สาธารณสุข", "เวชระเบียน", "สุขภาพ", "ผู้ป่วย", "ส่องกล้อง"],
  },
  education: {
    label: "การศึกษา / e-Learning / ห้องสมุด",
    terms: ["การศึกษา", "โรงเรียน", "e-learning", "ห้องสมุด", "การเรียนรู้", "ห้องเรียน"],
  },
} as const satisfies Record<string, { label: string; terms: readonly string[] }>;

export type WorkType = keyof typeof WORK_TYPES;
export const WORK_TYPE_KEYS = Object.keys(WORK_TYPES) as WorkType[];

/**
 * English terms must match as whole words — "gis" is inside "logistics", "ups"
 * inside "backups". Thai is written without spaces, so its terms can't be held
 * to word boundaries and are matched as they appear.
 */
const ENGLISH = /^[a-z0-9 .-]+$/;
const MATCHERS = Object.fromEntries(
  Object.entries(WORK_TYPES).map(([type, { terms }]) => [
    type,
    terms.map((term) =>
      ENGLISH.test(term)
        ? (text: string) => new RegExp(`(^|[^a-z])${term.replace(/[.-]/g, "\\$&")}([^a-z]|$)`).test(text)
        : (text: string) => text.includes(term),
    ),
  ]),
) as Record<WorkType, ((text: string) => boolean)[]>;

/** Every kind of work the announcement's own wording names; empty when it names none. */
export function workTypesOf(text: string): WorkType[] {
  const haystack = text.toLowerCase();
  return WORK_TYPE_KEYS.filter((type) => MATCHERS[type].some((matches) => matches(haystack)));
}

export function workTypeLabel(type: WorkType): string {
  return WORK_TYPES[type].label;
}
