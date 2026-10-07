import { Role } from "../common/roles";
import { AccountStatus, CompanyProfile, TorDoc } from "./database.service";

export type SeedUser = {
  email: string;
  name: string;
  role: Role;
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
    email: "owner@bma.go.th",
    name: "เจ้าของโครงการ",
    role: "owner",
    status: "approved",
    password: "Owner1234!",
  },
  {
    email: "auditor@bma.go.th",
    name: "ผู้ตรวจสอบ",
    role: "auditor",
    status: "approved",
    password: "Auditor1234!",
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
      workTypes: ["development", "maintenance"],
      largestPastContract: 4_200_000,
      registeredCapital: 5_000_000,
      certifications: ["iso9001"],
      preferredBudgetMin: 1_000_000,
      preferredBudgetMax: 10_000_000,
      pastExperience:
        "พัฒนาระบบยื่นคำร้องออนไลน์ให้สำนักงานเขตกว่า 10 แห่ง และเว็บพอร์ทัลบริการประชาชนของหน่วยงานราชการส่วนกลาง รวมถึงงานปรับปรุงประสบการณ์ผู้ใช้ให้เว็บไซต์ภาครัฐผ่านเกณฑ์การเข้าถึง (WCAG)",
    },
  },
  // Three more approved companies, each shaped to meet a different kind of
  // open tender — so the dashboard and the "matched companies" panel show a
  // real spread: a clear fit, a hardware dealer, and one that fails a
  // requirement on the bigger contracts.
  {
    email: "sales@siamnetwork.co.th",
    name: "Siam Network Solution",
    role: "org",
    status: "approved",
    password: "Siam12345!",
    company: {
      companyName: "บริษัท สยามเน็ตเวิร์ค โซลูชั่น จำกัด",
      taxId: "0105563001252",
      contactName: "สมชาย เครือข่ายกุล",
      phone: "02-555-0101",
      address: "199 อาคารสยามทาวเวอร์ ถนนพระราม 4 แขวงสุริยวงศ์ เขตบางรัก กรุงเทพมหานคร 10500",
      specialty: "",
      size: "51-200 คน",
      workTypes: ["maintenance", "network", "datacenter", "security", "eservice"],
      largestPastContract: 8_000_000,
      registeredCapital: 5_000_000,
      certifications: ["iso9001", "iso27001"],
      preferredBudgetMin: 2_000_000,
      preferredBudgetMax: 20_000_000,
      pastExperience:
        "บำรุงรักษาระบบเครือข่ายและโปรแกรมประยุกต์ให้หน่วยงานของกรุงเทพมหานครต่อเนื่อง 5 ปี รวมถึงระบบรับเงินและระบบบริการประชาชนของสำนักงานเขต",
    },
  },
  {
    email: "contact@itsupply.co.th",
    name: "IT Supply",
    role: "org",
    status: "approved",
    password: "Supply12345!",
    company: {
      companyName: "บริษัท ไอที ซัพพลาย จำกัด",
      taxId: "0105564003186",
      contactName: "วิภา จัดหาพร",
      phone: "02-555-0202",
      address: "55 ถนนแจ้งวัฒนะ แขวงทุ่งสองห้อง เขตหลักสี่ กรุงเทพมหานคร 10210",
      specialty: "",
      size: "11-50 คน",
      workTypes: ["hardware", "peripherals", "license"],
      largestPastContract: 3_000_000,
      registeredCapital: 3_000_000,
      certifications: ["iso9001", "iso14001", "dealer"],
      preferredBudgetMin: 500_000,
      preferredBudgetMax: 5_000_000,
      pastExperience:
        "จัดหาเครื่องคอมพิวเตอร์ โน้ตบุ๊ก และเครื่องพิมพ์ให้โรงเรียนและสำนักงานเขต ในฐานะตัวแทนจำหน่ายที่ได้รับแต่งตั้งจากผู้ผลิต พร้อมศูนย์บริการในกรุงเทพมหานคร",
    },
  },
  {
    email: "hello@helpdeskpro.co.th",
    name: "Helpdesk Pro",
    role: "org",
    status: "approved",
    password: "Help12345!",
    company: {
      companyName: "บริษัท เฮลป์เดสก์ โปร จำกัด",
      taxId: "0105565002213",
      contactName: "กิตติ บริการดี",
      phone: "02-555-0303",
      address: "18 ถนนวิภาวดีรังสิต แขวงจอมพล เขตจตุจักร กรุงเทพมหานคร 10900",
      specialty: "",
      size: "11-50 คน",
      workTypes: ["helpdesk", "maintenance", "eservice"],
      largestPastContract: 1_200_000,
      registeredCapital: 1_000_000,
      certifications: ["iso20000"],
      preferredBudgetMin: 500_000,
      preferredBudgetMax: 4_000_000,
      pastExperience:
        "ให้บริการ IT Helpdesk และดูแลผู้ใช้งานระบบให้รัฐวิสาหกิจ รวมถึงบำรุงรักษาระบบบริการประชาชนขนาดเล็ก",
    },
  },
  // Does exactly the work the open network-and-application maintenance tenders
  // ask for, but its largest past contract is below what the bigger ones
  // require — the case that shows a perfect fit capped by a failed requirement.
  {
    email: "contact@softstart.co.th",
    name: "Soft Start",
    role: "org",
    status: "approved",
    password: "Start12345!",
    company: {
      companyName: "บริษัท ซอฟต์สตาร์ท จำกัด",
      taxId: "0105566004521",
      contactName: "ปกรณ์ เริ่มดี",
      phone: "02-555-0404",
      address: "77 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพมหานคร 10400",
      specialty: "",
      size: "11-50 คน",
      workTypes: ["development", "maintenance", "eservice", "network"],
      largestPastContract: 1_500_000,
      registeredCapital: 5_000_000,
      certifications: ["iso9001"],
      preferredBudgetMin: 1_000_000,
      preferredBudgetMax: 10_000_000,
      pastExperience:
        "พัฒนาและดูแลระบบบริการประชาชนขนาดเล็กให้สำนักงานเขต ผลงานใหญ่ที่สุดมูลค่า 1.5 ล้านบาท",
    },
  },
  // Left pending so /admin/accounts has something to review on a fresh install,
  // and so the auth and accounts e2e suites can check that approval gates login.
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
      specialty: "",
      size: "11-50 คน",
      workTypes: ["datacenter", "network", "security"],
      largestPastContract: 12_000_000,
      registeredCapital: 10_000_000,
      certifications: ["iso9001", "iso27001", "iso20000"],
      preferredBudgetMin: 3_000_000,
      preferredBudgetMax: 30_000_000,
      pastExperience:
        "ย้ายระบบงานสารบรรณและระบบบริหารงบประมาณของหน่วยงานภาครัฐขึ้นคลาวด์ และดูแลงานด้านความมั่นคงปลอดภัยไซเบอร์",
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
