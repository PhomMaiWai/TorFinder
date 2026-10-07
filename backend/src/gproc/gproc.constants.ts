import { ProcurementStage, TOR_STAGES } from "../tor/tor.constants";

const [DRAFT_STAGE, INVITATION_STAGE, AWARD_STAGE] = TOR_STAGES;

/**
 * The national e-GP (กรมบัญชีกลาง, "process5"). Only its per-project endpoints
 * are called: the project *search* sits behind Cloudflare Turnstile, so the
 * project numbers come from an admin's own browser session (see /extension)
 * and are never searched for here.
 */
export const GPROC_ENDPOINTS = {
  base: "https://process5.gprocurement.go.th",
  announcement: "/egp-oann10-service/pb/a-egp-allt-project/announcement",
  documentInfo: "/egp-approval-service/apv-common/infoProcureDocAnnounZip",
  renderPdf: "/egp-template-service/dant/view-pdf",
  /** The same bundle before the invitation: the draft documents put out for comment. */
  draftDocumentInfo: "/egp-approval-service/apv-common/infoProcureDocAnnounZipTemp",
  download: "/egp-upload-service/v1/downloadFileTest",
} as const;

/** The public page that finds one project: process5's search, keyed by its number. */
export function gprocProjectUrl(projectNumber: string): string {
  return `${GPROC_ENDPOINTS.base}/egp-agpc01-web/announcement?keywordSearch=${encodeURIComponent(projectNumber)}`;
}

export const GPROC_REQUEST = {
  timeoutMs: 30_000,
  maxRetries: 3,
  /**
   * Pause between projects. process5 is a shared national service and a
   * capture is a batch nobody is waiting on, so it is read slowly.
   */
  delayMs: 500,
  /** Consecutive failures that end a run: the portal is down, not one project broken. */
  breaker: 3,
  /** Projects one capture accepts — the extension sends at most this many. */
  maxPerCapture: 100,
  /** A bundle is the bidding document, the TOR and a dozen forms; a few MB in practice. */
  maxBundleBytes: 30 * 1024 * 1024,
  /** Finished runs kept for the extension to read back. */
  runsKept: 20,
} as const;

/** An e-GP project number: 11 digits, year and agency encoded in it. */
export const PROJECT_NUMBER = /^\d{11}$/;

/**
 * process5's announcement codes, in the order a project moves through them.
 * Codes without a stage (the plan, the price notice, a withdrawal) are kept on
 * the paper trail but never decide which stage the project is at.
 */
export const GPROC_ANNOUNCE_TYPES: Record<
  string,
  { label: string; stage?: (typeof TOR_STAGES)[number] }
> = {
  P0: { label: "แผนการจัดซื้อจัดจ้าง" },
  price: { label: "ประกาศราคากลาง" },
  B0: { label: "ร่างเอกสารประกวดราคา", stage: DRAFT_STAGE },
  D0: { label: "ประกาศเชิญชวน", stage: INVITATION_STAGE },
  D1: { label: "ยกเลิกประกาศเชิญชวน" },
  W0: { label: "ประกาศผู้ชนะ", stage: AWARD_STAGE },
};

/** Rows on the announcement list that are attachments, not announcements. */
export const GPROC_IGNORED_TYPES = new Set(["BOQ"]);

/** `projectStatus` for a project the agency called off. */
export const GPROC_CANCELLED = "R";

/**
 * process5's step-group names onto stages. Order matters: "ประกาศผู้ชนะ"
 * contains ประกาศ, so the invitation is matched on เชิญชวน specifically, and a
 * cancellation wins over whatever step it stopped at.
 */
const STAGE_BY_FLOW: [RegExp, ProcurementStage][] = [
  [/ยกเลิก/, "cancelled"],
  [/เชิญชวน/, "invitation"],
  [/ผู้ชนะ|อนุมัติสั่ง/, "awarded"],
  [/สัญญา/, "contract"],
  [/รายงานขอซื้อขอจ้าง|เห็นชอบ/, "purchaseReport"],
  [/TOR/i, "tor"],
];

/** Null for a name not seen before — left unknown rather than guessed. */
export function stageFromFlow(name: string | null): ProcurementStage | null {
  return (name && STAGE_BY_FLOW.find(([pattern]) => pattern.test(name))?.[1]) || null;
}
