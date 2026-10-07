import { Collection } from "mongodb";

import { TorDoc } from "../database/database.service";
import { TOR_STAGES } from "./tor.constants";
import { parseThaiDate } from "./tor-normalize";

/**
 * Whether a company can still act on an announcement — bid on an invitation,
 * comment on a draft. Most e-GP records carry no closing date at all, so a date
 * alone would leave nearly everything "unknown"; the portal's own paper trail
 * is the stronger evidence and is read first. Nothing here is guessed: a record
 * with no evidence either way stays "unknown" rather than being called open.
 */
export type BiddingStatus = "open" | "closed" | "unknown";

/** Why the status is what it is, so the UI can say it rather than assert it. */
export type BiddingReason =
  /** This record, or another one for the same project, names a winner. */
  | "awarded"
  /** The portal's contract status shows a signed contract. */
  | "contracted"
  | "cancelled"
  /** The project has moved on to a later announcement (a draft that became an invitation). */
  | "superseded"
  /** Decided by the closing date alone. */
  | "deadline";

export type Bidding = {
  status: BiddingStatus;
  reason: BiddingReason | null;
  /** ISO timestamp the announcement that opened this stage was published. */
  opensAt: string | null;
  /** ISO timestamp, end of the closing day in Bangkok. */
  closesAt: string | null;
  /** Where `closesAt` came from: the portal, or a model reading the document. */
  closesAtSource: "portal" | "document" | null;
};

/** What the status is read from — kept structural so any projection of a TorDoc fits. */
export type BiddingFields = Pick<TorDoc, "stage" | "deadline" | "createdAt" | "procurementStep"> & {
  contractStatus?: string;
  projectNumber?: string;
  contracts?: unknown[];
  documents?: { label: string; publishedAt?: Date | null }[];
  /** `extraction.deadline`: an ISO date the model read from the document. */
  documentDeadline?: string | null;
};

const [DRAFT_STAGE, INVITATION_STAGE, AWARD_STAGE] = TOR_STAGES;

/** The portal's contract status for a project it has dropped — "ยกเลิกโครงการ". */
const PROJECT_CANCELLED = /ยกเลิกโครงการ/;
/**
 * Contract statuses that prove a contract exists: "จัดทำสัญญา/ PO แล้ว", the
 * "ส่งงาน…" delivery states, "หมดภาระผูกพันตามสัญญา". "ระหว่างดำเนินการ" is
 * deliberately not among them — e-GP shows it on projects still being
 * procured as well, and most of those have no winner on file yet.
 */
const CONTRACT_SIGNED = /สัญญา|PO|ส่งงาน/;
/**
 * A notice that withdraws another one ("ยกเลิกประกาศเชิญชวน") says nothing about
 * the project as a whole — it is usually re-announced — and must not count as
 * the notice it names.
 */
const WITHDRAWAL = /^\s*ยกเลิก/;
const WINNER_NOTICE = /ผู้ชนะ|ผู้ได้รับการคัดเลือก/;
const INVITATION_NOTICE = /เชิญชวน/;

/** End of an ISO day in Bangkok — bids are taken all day. 23:59:59 ICT is 16:59:59 UTC. */
function endOfDayBangkok(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 16, 59, 59));
}

function closingDate(tor: BiddingFields): Pick<Bidding, "closesAt" | "closesAtSource"> {
  const portal = parseThaiDate(tor.deadline);
  if (portal) return { closesAt: portal.toISOString(), closesAtSource: "portal" };

  const document = tor.documentDeadline ? endOfDayBangkok(tor.documentDeadline) : null;
  if (document) return { closesAt: document.toISOString(), closesAtSource: "document" };

  return { closesAt: null, closesAtSource: null };
}

const DRAFT_NOTICE = /ร่าง/;

/**
 * When the window this record is about opened: the draft's publication for a
 * draft, the invitation's for everything after it — an award's history starts
 * where the bidding did. The record's own date stands in when the paper trail
 * has none.
 */
function openingDate(tor: BiddingFields): string | null {
  const opener = tor.stage === DRAFT_STAGE ? DRAFT_NOTICE : INVITATION_NOTICE;
  const published = (tor.documents ?? [])
    .filter((doc) => opener.test(doc.label) && !WITHDRAWAL.test(doc.label) && doc.publishedAt)
    .map((doc) => new Date(doc.publishedAt!).getTime());
  if (published.length) return new Date(Math.min(...published)).toISOString();
  if (tor.stage === AWARD_STAGE) return null;
  const created = new Date(tor.createdAt);
  return Number.isNaN(created.getTime()) ? null : created.toISOString();
}

/** The portal's paper trail, strongest evidence first; null when it says nothing. */
function closedBy(tor: BiddingFields, awardedProjects: ReadonlySet<string>): BiddingReason | null {
  if (tor.stage === AWARD_STAGE) return "awarded";

  // The national flow's own step outranks everything inferred below.
  const step = tor.procurementStep?.stage;
  if (step === "cancelled") return "cancelled";
  if (step === "awarded") return "awarded";
  if (step === "contract") return "contracted";
  if (tor.stage === DRAFT_STAGE && step === "invitation") return "superseded";

  if (tor.contractStatus && PROJECT_CANCELLED.test(tor.contractStatus)) return "cancelled";
  if (tor.contracts?.length) return "contracted";
  if (tor.contractStatus && CONTRACT_SIGNED.test(tor.contractStatus)) return "contracted";

  const labels = (tor.documents ?? [])
    .map((doc) => doc.label)
    .filter((label) => !WITHDRAWAL.test(label));
  if (tor.projectNumber && awardedProjects.has(tor.projectNumber)) return "awarded";
  if (labels.some((label) => WINNER_NOTICE.test(label))) return "awarded";
  // A draft's comment window is over once the invitation to bid is out.
  if (tor.stage === DRAFT_STAGE && labels.some((label) => INVITATION_NOTICE.test(label))) {
    return "superseded";
  }
  return null;
}

export function biddingOf(
  tor: BiddingFields,
  awardedProjects: ReadonlySet<string>,
  now = Date.now(),
): Bidding {
  const closing = { opensAt: openingDate(tor), ...closingDate(tor) };

  const reason = closedBy(tor, awardedProjects);
  if (reason) return { status: "closed", reason, ...closing };

  if (closing.closesAt && (tor.stage === DRAFT_STAGE || tor.stage === INVITATION_STAGE)) {
    const open = new Date(closing.closesAt).getTime() > now;
    return { status: open ? "open" : "closed", reason: "deadline", ...closing };
  }

  return { status: "unknown", reason: null, ...closing };
}

/**
 * Projects that already have a winner on any portal. The project number is the
 * one identifier e-GP and MEA share, so a TOR imported from one portal is known
 * to be decided even when the award was published on the other.
 */
export async function awardedProjectNumbers(tors: Collection<TorDoc>): Promise<Set<string>> {
  const numbers = await tors.distinct("projectNumber", {
    stage: AWARD_STAGE,
    deletedAt: { $exists: false },
    projectNumber: { $type: "string" },
  });
  return new Set(numbers as string[]);
}
