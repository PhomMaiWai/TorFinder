export const TOR_STAGES = ["เปิดรับฟังความคิดเห็น", "ประกาศ TOR", "ประกาศผู้ชนะ"] as const;
export const TOR_BUDGET_STATUSES = ["สูงกว่าปกติ", "ต่ำกว่าปกติ", "ปกติ"] as const;

/**
 * The portals records are imported from. A record's `sourceRef` is prefixed
 * with the one it came from (`egp:69089649017:D0`), which is what lets a
 * listing be filtered by source without a second field to keep in step.
 */
export const TOR_IMPORT_SOURCES = ["egp", "mea", "datagov"] as const;
export type TorImportSource = (typeof TOR_IMPORT_SOURCES)[number];

/**
 * Which copy of a project survives when two sources publish it. An admin typed
 * theirs in deliberately, so it always wins. Then e-GP, the official portal an
 * agency is required to publish on; then the agency's own site, which adds
 * documents but only covers itself; last the open-data dumps, which are
 * historical contract records rather than announcements anyone can still act on.
 */
const SOURCE_RANK: Record<TorImportSource | "manual", number> = {
  manual: 3,
  egp: 2,
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
