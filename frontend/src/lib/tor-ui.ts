import type { TorRecord, TorStage } from "@/types/tor";

/** What the backend stores when the e-GP announcement doesn't carry the value. */
export const UNKNOWN_VALUE = "ไม่ระบุ";

export function isKnown(value: string | undefined): boolean {
  return !!value && value !== UNKNOWN_VALUE;
}

const BAHT = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

/**
 * The money an announcement carries, and which of the two things it is. A
 * winning-bidder notice has no budget to publish — the bidding is over — so it
 * carries what the contract was awarded for instead, and showing that under
 * "งบประมาณโครงการ" would be calling one number by the other's name.
 */
export function torAmount(tor: Pick<TorRecord, "budget" | "awardedAmount">): {
  value: string;
  isAwarded: boolean;
} {
  if (isKnown(tor.budget)) return { value: tor.budget, isAwarded: false };
  if (tor.awardedAmount) return { value: BAHT.format(tor.awardedAmount), isAwarded: true };
  return { value: UNKNOWN_VALUE, isAwarded: false };
}

export function stageBadgeCls(stage: TorStage): string {
  if (stage === "ประกาศผู้ชนะ") return "bg-purple-50 text-purple-700";
  if (stage === "เปิดรับฟังความคิดเห็น") return "bg-amber-50 text-amber-700";
  return "bg-accent-soft text-accent";
}
