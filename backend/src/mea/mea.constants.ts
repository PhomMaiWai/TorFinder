import { TOR_STAGES } from "../tor/tor.constants";

/**
 * Which portal this integration talks to. Not environment config: the site is
 * an ASP.NET app whose listing pages each expose their own search action, so
 * pointing this elsewhere means different code.
 */
export const MEA_ENDPOINTS = {
  site: "https://procurement.mea.or.th",
} as const;

/** Client behaviour, not deployment config: how one request is made. */
export const MEA_REQUEST = {
  /** Rows per DataTables page. The awards listing alone runs to ~10,000. */
  pageSize: 1_000,
  /** The listings decide what exists, so they're worth waiting for. */
  timeoutMs: 30_000,
  maxRetries: 3,
  /** Per-announcement detail is supplementary: fail fast, retry next sync. */
  detailTimeoutMs: 8_000,
} as const;

/**
 * The three listings that map onto a TOR stage. The site publishes more —
 * plans, reference prices, contract summaries, the separate มาตรา 7 section —
 * and they are deliberately left out: none of them is an announcement a
 * company can still bid on or comment on.
 *
 * `shape` is how each listing answers. Two of them speak the DataTables
 * server-side protocol (a `{ data: [...] }` envelope, paged); `/Draft` returns
 * a bare array of the whole table. That difference is the portal's, not ours.
 */
export const MEA_ANNOUNCE_TYPES = [
  {
    path: "Draft",
    label: "ประกาศรับฟังความคิดเห็น",
    stage: "เปิดรับฟังความคิดเห็น",
    shape: "array",
  },
  {
    path: "Procurement",
    label: "ประกาศข่าวจัดซื้อจัดจ้าง",
    stage: "ประกาศ TOR",
    shape: "datatable",
  },
  {
    path: "WinningBidder",
    label: "ประกาศผู้ชนะการเสนอราคา",
    stage: "ประกาศผู้ชนะ",
    shape: "datatable",
  },
] as const satisfies readonly {
  path: string;
  label: string;
  stage: (typeof TOR_STAGES)[number];
  shape: "array" | "datatable";
}[];

export type MeaAnnounceType = (typeof MEA_ANNOUNCE_TYPES)[number];

/** The buying organization. Every announcement here is one utility's. */
export const MEA_AGENCY = "การไฟฟ้านครหลวง";

/**
 * Reading the detail pages, which is the only place two of the three listings
 * publish a budget. Client behaviour rather than deployment config: these are
 * about how hard one portal may be hit, not about where it runs.
 */
export const MEA_ENRICHMENT = {
  concurrency: 5,
  /**
   * Wall-clock cap. A slow portal degrades the sync — whatever wasn't read is
   * picked up next run — instead of stalling it.
   */
  budgetMs: 45_000,
  /** Bump when detail parsing starts collecting something new; forces one refetch. */
  version: 3,
} as const;
