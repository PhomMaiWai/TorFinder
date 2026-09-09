import { TOR_STAGES } from "../tor/tor.constants";

/**
 * Announcement types published by the official e-GP RSS service.
 * `satisfies` keeps every mapped value a real TOR stage without tying the
 * mapping to the order of TOR_STAGES.
 */
export const EGP_ANNOUNCE_TYPES = {
  /** ร่างเอกสารประกวดราคา */
  B0: "เปิดรับฟังความคิดเห็น",
  /** ประกาศเชิญชวน */
  D0: "ประกาศ TOR",
  /** ประกาศรายชื่อผู้ชนะ */
  W0: "ประกาศผู้ชนะ",
} as const satisfies Record<string, (typeof TOR_STAGES)[number]>;

export type EgpAnnounceType = keyof typeof EGP_ANNOUNCE_TYPES;

export const EGP_ANNOUNCE_TYPE_LIST = Object.keys(EGP_ANNOUNCE_TYPES) as EgpAnnounceType[];
