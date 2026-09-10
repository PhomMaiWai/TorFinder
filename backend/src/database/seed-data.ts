import { AccountStatus, CompanyProfile, TorDoc } from "./database.service";

export type SeedUser = {
  email: string;
  name: string;
  role: "admin" | "org";
  status: AccountStatus;
  password: string;
  company?: CompanyProfile;
};

/** Demo credentials — documented in the README so everyone starts from the same state. */
export const SEED_USERS: SeedUser[] = [
  {
    email: "admin@bma.go.th",
    name: "ผู้ดูแลระบบ",
    role: "admin",
    status: "approved",
    password: "Admin1234!",
  },
  {
    email: "contact@arundigital.co.th",
    name: "Arun Digital",
    role: "org",
    status: "approved",
    password: "Org12345!",
    company: {
      companyName: "บริษัท อรุณ ดิจิทัล จำกัด",
      taxId: "0105563001236",
      contactName: "อรุณ วัฒนกิจ",
      phone: "081-234-5678",
      address: "42 อาคารอรุณทาวเวอร์ ถนนสาทรใต้ แขวงยานนาวา เขตสาทร กรุงเทพมหานคร 10120",
      specialty: "Web Application",
      size: "11-50 คน",
      techStack: ["Next.js", "Web Application", "API", "UX/UI"],
      pastExperience:
        "พัฒนาระบบยื่นคำร้องออนไลน์ให้สำนักงานเขตกว่า 10 แห่ง และเว็บพอร์ทัลบริการประชาชนของหน่วยงานราชการส่วนกลาง รวมถึงงานปรับปรุงประสบการณ์ผู้ใช้ให้เว็บไซต์ภาครัฐผ่านเกณฑ์การเข้าถึง (WCAG)",
    },
  },
  // Left pending so /admin/accounts has something to review on a fresh install.
  {
    email: "contact@techworks.co.th",
    name: "บริษัท เทค เวิร์คส์ จำกัด",
    role: "org",
    status: "pending",
    password: "Tech12345!",
    company: {
      companyName: "บริษัท เทค เวิร์คส์ จำกัด",
      taxId: "0105563001244",
      contactName: "ณัฐพล เทควิศิษฏ์",
      phone: "089-123-4567",
      address: "88 ถนนรัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพมหานคร 10400",
      specialty: "Cloud Platform",
      size: "11-50 คน",
      techStack: ["Cloud", "Integration", "Security", "Dashboard"],
      pastExperience:
        "ย้ายระบบงานสารบรรณและระบบบริหารงบประมาณของหน่วยงานภาครัฐขึ้นคลาวด์ วางระบบเชื่อมต่อ API ระหว่างหน่วยงาน และดูแลงานด้านความมั่นคงปลอดภัยไซเบอร์ตามกรอบ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล",
    },
  },
  {
    email: "hello@datacraft.co.th",
    name: "บริษัท ดาต้าคราฟท์ จำกัด",
    role: "org",
    status: "pending",
    password: "Data12345!",
    company: {
      companyName: "บริษัท ดาต้าคราฟท์ จำกัด",
      taxId: "0105564009871",
      contactName: "ปวีณา ดาตาชัย",
      phone: "092-888-1234",
      address: "9 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310",
      specialty: "Data Platform",
      size: "1-10 คน",
      techStack: ["Data Platform", "Dashboard", "API"],
      pastExperience:
        "จัดทำแดชบอร์ดติดตามตัวชี้วัดและคลังข้อมูลให้สำนักยุทธศาสตร์ของหน่วยงานท้องถิ่น พร้อมวางกระบวนการรวมข้อมูลจากหลายแหล่งและ API เปิดเผยข้อมูลภาครัฐ (Open Data)",
    },
  },
];

type SeedTor = Omit<TorDoc, "createdAt" | "match"> & { daysAgo: number };

/** Admin-entered records, so the TOR pages aren't empty before an e-GP sync. */
export const SEED_TORS: SeedTor[] = [
  {
    title: "จ้างพัฒนาระบบบริหารจัดการงานซ่อมบำรุงถนนและทางเท้า",
    agency: "สำนักการโยธา",
    budget: "฿8,400,000",
    deadline: "30 ก.ย. 2569",
    daysLeft: 21,
    tags: ["Web Application", "GIS", "Mobile"],
    stage: "ประกาศ TOR",
    summary:
      "พัฒนาระบบรับแจ้งและติดตามงานซ่อมบำรุงถนน ทางเท้า และสาธารณูปโภค พร้อมแผนที่แสดงตำแหน่งงานและรายงานสรุปสำหรับผู้บริหาร",
    budgetStatus: "ปกติ",
    daysAgo: 2,
  },
  {
    title: "จัดหาระบบวิเคราะห์คุณภาพอากาศด้วยเซ็นเซอร์ IoT",
    agency: "สำนักสิ่งแวดล้อม",
    budget: "฿15,200,000",
    deadline: "12 ต.ค. 2569",
    daysLeft: 33,
    tags: ["IoT", "Data Platform", "Dashboard"],
    stage: "เปิดรับฟังความคิดเห็น",
    summary:
      "ติดตั้งสถานีตรวจวัดคุณภาพอากาศแบบเซ็นเซอร์ 120 จุดทั่วกรุงเทพมหานคร พร้อมระบบวิเคราะห์และแจ้งเตือนค่าฝุ่น PM2.5 แบบเรียลไทม์",
    budgetStatus: "ปกติ",
    daysAgo: 5,
  },
  {
    title: "พัฒนาแอปพลิเคชันนัดหมายและเวชระเบียนผู้ป่วยนอก",
    agency: "สำนักการแพทย์",
    budget: "฿22,700,000",
    deadline: "5 ต.ค. 2569",
    daysLeft: 26,
    tags: ["HealthTech", "Mobile", "Integration"],
    stage: "ประกาศ TOR",
    summary:
      "พัฒนาแอปพลิเคชันสำหรับนัดหมายแพทย์ ดูผลตรวจ และเชื่อมโยงเวชระเบียนระหว่างโรงพยาบาลในสังกัดกรุงเทพมหานคร",
    budgetStatus: "สูงกว่าปกติ",
    daysAgo: 8,
  },
  {
    title: "ปรับปรุงระบบสัญญาณไฟจราจรอัจฉริยะ ระยะที่ 3",
    agency: "สำนักการจราจรและขนส่ง",
    budget: "฿31,000,000",
    deadline: "20 ก.ย. 2569",
    daysLeft: 11,
    tags: ["IoT", "Integration", "Cloud"],
    stage: "ประกาศผู้ชนะ",
    summary:
      "ปรับปรุงระบบควบคุมสัญญาณไฟจราจรให้ปรับเวลาตามปริมาณรถอัตโนมัติ ครอบคลุมทางแยกหลัก 45 แห่ง",
    budgetStatus: "ปกติ",
    daysAgo: 14,
  },
  {
    title: "จ้างที่ปรึกษาจัดทำแผนแม่บทข้อมูลเปิดภาครัฐของ กทม.",
    agency: "สำนักยุทธศาสตร์และประเมินผล",
    budget: "฿4,600,000",
    deadline: "18 ต.ค. 2569",
    daysLeft: 39,
    tags: ["Consulting", "Open Data"],
    stage: "เปิดรับฟังความคิดเห็น",
    summary:
      "จัดทำแผนแม่บทและมาตรฐานการเปิดเผยข้อมูลภาครัฐของกรุงเทพมหานคร พร้อมออกแบบสถาปัตยกรรมข้อมูลกลาง",
    budgetStatus: "ต่ำกว่าปกติ",
    daysAgo: 20,
  },
];
