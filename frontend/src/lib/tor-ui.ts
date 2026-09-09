import type { TorStage } from "@/types/tor";

/** What the backend stores when the e-GP announcement doesn't carry the value. */
export const UNKNOWN_VALUE = "ไม่ระบุ";

export function isKnown(value: string | undefined): boolean {
  return !!value && value !== UNKNOWN_VALUE;
}

export function stageBadgeCls(stage: TorStage): string {
  if (stage === "ประกาศผู้ชนะ") return "bg-purple-50 text-purple-700";
  if (stage === "เปิดรับฟังความคิดเห็น") return "bg-amber-50 text-amber-700";
  return "bg-accent-soft text-accent";
}
