import { Bell, CheckCircle2, MessageSquare, Sparkles, type LucideIcon } from "lucide-react";

export type NotificationType = "match" | "approval" | "feedback" | "system";

export type Notification = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
};

export const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  match: Sparkles,
  approval: CheckCircle2,
  feedback: MessageSquare,
  system: Bell,
};

export const NOTIFICATION_TONE: Record<NotificationType, "accent" | "success" | "neutral"> = {
  match: "accent",
  approval: "success",
  feedback: "accent",
  system: "neutral",
};

export const NOTIFICATION_FILTERS: { id: "all" | "unread" | NotificationType; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "unread", label: "ยังไม่อ่าน" },
  { id: "match", label: "จับคู่ TOR" },
  { id: "approval", label: "อนุมัติ" },
  { id: "feedback", label: "ความคิดเห็น" },
  { id: "system", label: "ระบบ" },
];

export const NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    type: "match",
    title: "พบ TOR ที่ตรงกับโปรไฟล์คุณ",
    message: "พัฒนาระบบบริหารจัดการศูนย์ข้อมูลเมืองอัจฉริยะ ตรงกับโปรไฟล์บริษัท 96%",
    time: "5 นาทีที่แล้ว",
    read: false,
  },
  {
    id: 2,
    type: "approval",
    title: "บัญชีของคุณได้รับการอนุมัติแล้ว",
    message: "ผู้ดูแลระบบอนุมัติบัญชี Arun Digital Co., Ltd เรียบร้อยแล้ว เข้าใช้งานได้ทันที",
    time: "2 ชั่วโมงที่แล้ว",
    read: false,
  },
  {
    id: 3,
    type: "match",
    title: "ใกล้ครบกำหนดส่งความคิดเห็น",
    message: "TOR \"พัฒนาแอปพลิเคชันบริการประชาชนสำหรับงานเขต\" ปิดรับความคิดเห็นใน 2 วัน",
    time: "เมื่อวาน",
    read: true,
  },
  {
    id: 4,
    type: "feedback",
    title: "ความคิดเห็นของคุณได้รับการอนุมัติ",
    message: "ความคิดเห็นที่ส่งต่อ TOR #2 ผ่านการตรวจสอบจากผู้ดูแลระบบแล้ว",
    time: "เมื่อวาน",
    read: true,
  },
  {
    id: 5,
    type: "system",
    title: "อัปเดตระบบ",
    message: "Torr เพิ่มการแจ้งเตือนอัตโนมัติเมื่อพบ TOR ที่ตรงกับโปรไฟล์บริษัทของคุณ",
    time: "3 วันที่แล้ว",
    read: true,
  },
];
