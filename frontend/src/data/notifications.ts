import { Bell, CheckCircle2, MessageSquare, Sparkles, type LucideIcon } from "lucide-react";

export type NotificationType = "match" | "approval" | "feedback" | "system";

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
