export const TOR_STAGES = ["เปิดรับฟังความคิดเห็น", "ประกาศ TOR", "ประกาศผู้ชนะ"] as const;
export const TOR_BUDGET_STATUSES = ["สูงกว่าปกติ", "ต่ำกว่าปกติ", "ปกติ"] as const;

/**
 * Where a project stands in the national e-GP's procurement flow, in the order
 * it moves: preparing the TOR, the purchase report, the invitation to bid, the
 * winner, the contract — or called off. Read from process5 (see GprocClient).
 */
export const PROCUREMENT_STAGES = ["tor", "purchaseReport", "invitation", "awarded", "contract", "cancelled"] as const;
export type ProcurementStage = (typeof PROCUREMENT_STAGES)[number];

/** Stages after which nothing about the bidding changes any more. */
export const DECIDED_STAGES: readonly ProcurementStage[] = ["awarded", "contract", "cancelled"];

/**
 * How far back an announcement can still be bid on or commented on. A Thai
 * e-bidding closes within weeks of its invitation; anything older is decided.
 */
export const ACTIONABLE_WINDOW_MS = 90 * 24 * 60 * 60_000;

/**
 * The portals records are imported from. A record's `sourceRef` is prefixed
 * with the one it came from (`egp:69089649017:D0`), which is what lets a
 * listing be filtered by source without a second field to keep in step.
 */
export const TOR_IMPORT_SOURCES = ["egp", "gproc", "mea", "datagov"] as const;
export type TorImportSource = (typeof TOR_IMPORT_SOURCES)[number];

/**
 * Which copy of a project survives when two sources publish it. An admin typed
 * theirs in deliberately, so it always wins. Then Bangkok's e-GP, which carries
 * the files and the signed contracts; then the national e-GP (process5), the
 * same announcement with less around it; then the agency's own site, which adds
 * documents but only covers itself; last the open-data dumps, which are
 * historical contract records rather than announcements anyone can still act on.
 */
const SOURCE_RANK: Record<TorImportSource | "manual", number> = {
  manual: 4,
  egp: 3,
  gproc: 2,
  mea: 1,
  datagov: 0,
};

/** The source a `sourceRef` belongs to; no ref at all means an admin entered it. */
export function sourceOf(sourceRef: string | undefined): TorImportSource | "manual" {
  const prefix = sourceRef?.split(":")[0];
  return TOR_IMPORT_SOURCES.find((source) => source === prefix) ?? "manual";
}

export function sourceRank(source: TorImportSource | "manual"): number {
  return SOURCE_RANK[source];
}
