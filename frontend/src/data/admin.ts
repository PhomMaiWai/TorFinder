import { Activity, type LucideIcon } from "lucide-react";

export type PipelineMetric = {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  tone: "success" | "neutral";
};

export const PIPELINE_METRICS: PipelineMetric[] = [
  {
    label: "สถานะ Pipeline",
    value: "ปกติ",
    sub: "อัปเดตล่าสุด 2 นาทีที่แล้ว",
    icon: Activity,
    tone: "success",
  },
  {
    label: "TOR ใหม่วันนี้",
    value: "23",
    sub: "จาก 47 หน่วยงาน กทม.",
    icon: Activity,
    tone: "neutral",
  },
  {
    label: "จำแนกประเภทแล้ว",
    value: "21 / 23",
    sub: "รอจำแนก 2 รายการ",
    icon: Activity,
    tone: "neutral",
  },
  {
    label: "แจ้งเตือนบริษัท",
    value: "87",
    sub: "ส่งสำเร็จทั้งหมด",
    icon: Activity,
    tone: "success",
  },
];

export type ScrapeRun = {
  date: string;
  newCount: number;
  status: "สำเร็จ" | "ล้มเหลว";
};

export const SCRAPE_HISTORY: ScrapeRun[] = [
  { date: "12 ส.ค. 2569 08:00", newCount: 23, status: "สำเร็จ" },
  { date: "11 ส.ค. 2569 08:00", newCount: 18, status: "สำเร็จ" },
  { date: "10 ส.ค. 2569 08:00", newCount: 31, status: "สำเร็จ" },
  { date: "9 ส.ค. 2569 08:00", newCount: 0, status: "ล้มเหลว" },
  { date: "8 ส.ค. 2569 08:00", newCount: 14, status: "สำเร็จ" },
];

export type ClassificationStat = {
  label: string;
  count: number;
  pct: number;
};

export const CLASSIFICATION_STATS: ClassificationStat[] = [
  { label: "ซอฟต์แวร์", count: 21, pct: 91 },
  { label: "ไม่ใช่ซอฟต์แวร์", count: 2, pct: 9 },
  { label: "รอจำแนก", count: 0, pct: 0 },
];

export type AuditLogEntry = {
  id: number;
  action: string;
  detail: string;
  actor: string;
  date: string;
  type: "auto" | "manual";
};

export const AUDIT_LOG: AuditLogEntry[] = [
  {
    id: 1,
    action: "จำแนก TOR",
    detail: "พัฒนาระบบบริหารจัดการศูนย์ข้อมูล → ซอฟต์แวร์",
    actor: "Vertex AI",
    date: "12 ส.ค. 2569 13:45",
    type: "auto",
  },
  {
    id: 2,
    action: "อนุมัติความคิดเห็น",
    detail: "บริษัท เทค เวิร์คส์ — TOR #1",
    actor: "admin@bma.go.th",
    date: "12 ส.ค. 2569 11:20",
    type: "manual",
  },
  {
    id: 3,
    action: "แก้ไข TOR",
    detail: "TOR #2 — แก้ไขขอบเขตงาน (manual correction)",
    actor: "admin@bma.go.th",
    date: "11 ส.ค. 2569 16:05",
    type: "manual",
  },
  {
    id: 4,
    action: "Scrape สำเร็จ",
    detail: "ดึงข้อมูลจาก e-GP 23 รายการ",
    actor: "Scraper Bot",
    date: "11 ส.ค. 2569 08:00",
    type: "auto",
  },
  {
    id: 5,
    action: "ปฏิเสธความคิดเห็น",
    detail: "Spam — TOR #3",
    actor: "admin@bma.go.th",
    date: "10 ส.ค. 2569 14:30",
    type: "manual",
  },
];

export type CompanyStatus = "ใช้งาน" | "ระงับ";

export type AdminCompany = {
  id: number;
  name: string;
  email: string;
  specialty: string;
  size: string;
  status: CompanyStatus;
  joinedAt: string;
  torCount: number;
};

export const ADMIN_COMPANIES: AdminCompany[] = [
  {
    id: 1,
    name: "Arun Digital Co., Ltd",
    email: "contact@arundigital.co.th",
    specialty: "Government Digital Platforms",
    size: "11-50 คน",
    status: "ใช้งาน",
    joinedAt: "1 ก.ค. 2569",
    torCount: 12,
  },
  {
    id: 2,
    name: "บริษัท เทค เวิร์คส์ จำกัด",
    email: "contact@techworks.co.th",
    specialty: "Cloud Platform",
    size: "11-50 คน",
    status: "ใช้งาน",
    joinedAt: "15 ก.ค. 2569",
    torCount: 8,
  },
  {
    id: 3,
    name: "บริษัท เฮลท์ ซิส จำกัด",
    email: "info@healthsys.co.th",
    specialty: "HealthTech",
    size: "51-200 คน",
    status: "ใช้งาน",
    joinedAt: "20 ก.ค. 2569",
    torCount: 5,
  },
  {
    id: 4,
    name: "บริษัท เว็บดีไซน์ แอนด์ เดฟ จำกัด",
    email: "info@webdesigndev.co.th",
    specialty: "Web Application",
    size: "1-10 คน",
    status: "ระงับ",
    joinedAt: "3 ส.ค. 2569",
    torCount: 2,
  },
];

export type UserRole = "เจ้าของบัญชี" | "ผู้ดูแลระบบ" | "สมาชิก";
export type UserStatus = "ใช้งาน" | "ระงับ";

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  company: string;
  role: UserRole;
  status: UserStatus;
  lastActive: string;
};

export const ADMIN_USERS: AdminUser[] = [
  {
    id: 1,
    name: "อรุณ ดิจิทัล",
    email: "contact@arundigital.co.th",
    company: "Arun Digital Co., Ltd",
    role: "เจ้าของบัญชี",
    status: "ใช้งาน",
    lastActive: "5 นาทีที่แล้ว",
  },
  {
    id: 2,
    name: "ณัฐพล เทควิศิษฏ์",
    email: "contact@techworks.co.th",
    company: "บริษัท เทค เวิร์คส์ จำกัด",
    role: "เจ้าของบัญชี",
    status: "ใช้งาน",
    lastActive: "2 ชั่วโมงที่แล้ว",
  },
  {
    id: 3,
    name: "สุพรรณี เวชสิริ",
    email: "info@healthsys.co.th",
    company: "บริษัท เฮลท์ ซิส จำกัด",
    role: "เจ้าของบัญชี",
    status: "ใช้งาน",
    lastActive: "เมื่อวาน",
  },
  {
    id: 4,
    name: "ทีมผู้ดูแลระบบ",
    email: "admin@bma.go.th",
    company: "Torr Admin",
    role: "ผู้ดูแลระบบ",
    status: "ใช้งาน",
    lastActive: "11 นาทีที่แล้ว",
  },
  {
    id: 5,
    name: "ผู้ติดต่อ เว็บดีไซน์",
    email: "info@webdesigndev.co.th",
    company: "บริษัท เว็บดีไซน์ แอนด์ เดฟ จำกัด",
    role: "เจ้าของบัญชี",
    status: "ระงับ",
    lastActive: "12 ส.ค. 2569",
  },
];
