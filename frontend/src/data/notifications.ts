import { Bell, CheckCircle2, Sparkles, type LucideIcon } from "lucide-react";

export type NotificationType = "match" | "approval" | "system";

export const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  match: Sparkles,
  approval: CheckCircle2,
  system: Bell,
};

export const NOTIFICATION_TONE: Record<NotificationType, "accent" | "success" | "neutral"> = {
  match: "accent",
  approval: "success",
  system: "neutral",
};

export const NOTIFICATION_FILTERS: { id: "all" | "unread" | NotificationType; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "unread", label: "ยังไม่อ่าน" },
  { id: "match", label: "จับคู่ TOR" },
  { id: "approval", label: "อนุมัติ" },
  { id: "system", label: "ระบบ" },
];
