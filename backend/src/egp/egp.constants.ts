import { TOR_STAGES } from "../tor/tor.constants";

/**
 * Which portal this integration talks to. Not environment config: pointing it
 * somewhere else means a different API shape, i.e. different code — so it lives
 * next to the code that depends on it.
 */
export const EGP_ENDPOINTS = {
  api: "https://egp2.bangkok.go.th/appapi/api",
  listing: "https://egp2.bangkok.go.th/project-detail",
  file: "https://egp2.bangkok.go.th/api/file",
} as const;

export const EGP_USER_AGENT = "TorFinder/1.0 (Kasetsart University project)";

/**
 * The portal's text search runs once per keyword. These only decide what gets
 * *considered*; what actually gets imported is decided by egp.filter.ts, so the
 * two belong together rather than one being tunable from outside.
 */
export const EGP_SEARCH_KEYWORDS = [
  "ซอฟต์แวร์",
  "ระบบสารสนเทศ",
  "คอมพิวเตอร์",
  "พัฒนาระบบ",
  "เทคโนโลยีสารสนเทศ",
  "ดิจิทัล",
  "เว็บไซต์",
  "ฐานข้อมูล",
];

/** Client behaviour, not deployment config: how one request is made. */
export const EGP_REQUEST = {
  /** Results per search page — the portal's own maximum useful size. */
  pageSize: 50,
  /** The searches decide which projects exist, so they're worth waiting for. */
  timeoutMs: 30_000,
  maxRetries: 3,
  /** Per-project detail is supplementary: fail fast, retry on the next sync. */
  enrichTimeoutMs: 8_000,
} as const;

/**
 * Announcement types from the e-GP master list, keyed by the id the search API
 * expects. Only the ones that map onto a TOR stage are imported — cancellations
 * and quarterly summaries are deliberately left out.
 */
export const EGP_ANNOUNCE_TYPES = [
  {
    id: "24995aa2-d875-4d3d-9dec-d5e22d222aa4",
    code: "98",
    label: "ร่างขอบเขตของงาน (TOR)",
    stage: "เปิดรับฟังความคิดเห็น",
  },
  {
    id: "705f1ffb-82e2-4beb-bdd2-2746f0783bf0",
    code: "D0",
    label: "ประกาศเชิญชวน",
    stage: "ประกาศ TOR",
  },
  {
    id: "8a879a96-9fcc-48a0-aa06-8a39450d02bb",
    code: "W0",
    label: "ประกาศรายชื่อผู้ชนะการเสนอราคา / ประกาศรายชื่อผู้ได้รับการคัดเลือก",
    stage: "ประกาศผู้ชนะ",
  },
] as const satisfies readonly {
  id: string;
  code: string;
  label: string;
  stage: (typeof TOR_STAGES)[number];
}[];

export type EgpAnnounceType = (typeof EGP_ANNOUNCE_TYPES)[number];
