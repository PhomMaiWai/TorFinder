import { formatBaht } from "../tor/tor-normalize";
import { CLOSE_ENOUGH, median, MIN_PEERS, percentile, similarity, workKindOf } from "./budget-analysis";
import { skillsOf } from "./matching.scoring";

/** What the insight reads from a record; structural so a TorDoc fits as-is. */
export type BidPeer = {
  title: string;
  /** e-GP's project number; one project is stored once per announcement stage. */
  projectNumber?: string;
  summary: string;
  tags: string[];
  budgetAmount?: number;
  referencePrice?: number;
  awardedAmount?: number;
  contracts?: { vendor: string; amount: number | null }[];
  extraction?: { referencePrice?: number | null } | null;
};

/**
 * How crowded the market for this kind of work is, read from how far winners
 * had to go below the agency's price: a blue ocean is won near the reference
 * price, a red ocean only by cutting deep into it.
 */
export type Competition = "blue" | "moderate" | "red";

export type PricePoint = {
  label: "aggressive" | "recommended" | "conservative";
  price: number;
  /** price / base — 0.9 is ten percent under the agency's figure. */
  ratio: number;
  /** Share of comparable awards this bid would have undercut, 0-1. */
  winChance: number;
};

export type PastAward = {
  /** Identifies the award; absent on records imported without one. */
  projectNumber: string | null;
  title: string;
  vendor: string | null;
  base: number;
  awarded: number;
  /** 1 - awarded / base. */
  discount: number;
};

export type BidInsight = {
  status: "ok" | "insufficient";
  /** The figure prices are set against: ราคากลาง when published, else the budget. */
  base: number | null;
  baseKind: "reference" | "budget" | null;
  peerCount: number;
  /** True when too few close peers existed and the comparison widened. */
  broad: boolean;
  /** Median of how far below the base winners came in, 0-1. */
  medianDiscount: number | null;
  /** Mean of the same, so a reader can see a skew the median hides. */
  averageDiscount: number | null;
  competition: Competition | null;
  /** Distinct companies among the comparable awards, and the most frequent ones. */
  distinctWinners: number;
  topWinners: { vendor: string; wins: number }[];
  pricePoints: PricePoint[];
  recentAwards: PastAward[];
  notes: string[];
};

/** Winners this close to the base faced little price pressure. */
const BLUE_OCEAN_DISCOUNT = 0.05;
/** Winners this far under it were fighting on price. */
const RED_OCEAN_DISCOUNT = 0.15;
/**
 * A winning bid outside this band of its base is a data error — a contract for
 * one lot of a larger project, or a figure in the wrong unit — not a price.
 */
const SANE_RATIO = { min: 0.3, max: 1.05 };
/** Prices are quoted to the nearest thousand baht, as bids are. */
const ROUND_TO = 1_000;

function baseOf(tor: BidPeer): { value: number; kind: "reference" | "budget" } | null {
  const reference = tor.referencePrice ?? tor.extraction?.referencePrice ?? null;
  if (reference && reference > 0) return { value: reference, kind: "reference" };
  if (tor.budgetAmount && tor.budgetAmount > 0) return { value: tor.budgetAmount, kind: "budget" };
  return null;
}

/** What the work was awarded for: the published figure, else the signed contracts. */
function awardedOf(tor: BidPeer): number | null {
  if (tor.awardedAmount && tor.awardedAmount > 0) return tor.awardedAmount;
  const signed = (tor.contracts ?? []).reduce((sum, contract) => sum + (contract.amount ?? 0), 0);
  return signed > 0 ? signed : null;
}

function textOf(tor: BidPeer): string {
  return `${tor.title} ${tor.summary} ${tor.tags.join(" ")}`;
}

/** Share of past winning ratios at or above this one — the awards this bid would have beaten. */
function chanceAt(sortedRatios: number[], ratio: number): number {
  return sortedRatios.filter((won) => won >= ratio).length / sortedRatios.length;
}

function competitionOf(discount: number): Competition {
  if (discount < BLUE_OCEAN_DISCOUNT) return "blue";
  if (discount > RED_OCEAN_DISCOUNT) return "red";
  return "moderate";
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * Suggests what to bid on one announcement from what comparable projects were
 * actually won for. Statistical on purpose, like the budget check: every number
 * traces back to a published award a reader can look up. The "chance" is the
 * share of past winners a bid at that price would have undercut — a rough
 * guide to price competitiveness, not a forecast, since it knows nothing of
 * the other bidders or of how the qualifications are scored.
 */
export function assessBid(target: BidPeer, all: BidPeer[]): BidInsight {
  const base = baseOf(target);
  const empty: BidInsight = {
    status: "insufficient",
    base: base?.value ?? null,
    baseKind: base?.kind ?? null,
    peerCount: 0,
    broad: false,
    medianDiscount: null,
    averageDiscount: null,
    competition: null,
    distinctWinners: 0,
    topWinners: [],
    pricePoints: [],
    recentAwards: [],
    notes: [],
  };

  if (!base) {
    empty.notes.push("ประกาศนี้ไม่ระบุราคากลางหรือวงเงิน จึงแนะนำราคาเสนอไม่ได้");
    return empty;
  }

  const wanted = skillsOf(textOf(target));
  const kind = workKindOf(target.title);

  // A project appears once per announcement stage, each carrying the award, so
  // without this one contract would count several times — and the target's
  // own award notice would be compared against itself. Only the project number
  // proves two records are one project: yearly contracts repeat title and price.
  const seen = new Set<string>(target.projectNumber ? [target.projectNumber] : []);
  const scored = all.flatMap((peer) => {
    if (peer === target) return [];
    if (peer.projectNumber) {
      if (seen.has(peer.projectNumber)) return [];
      seen.add(peer.projectNumber);
    }
    const peerBase = baseOf(peer);
    const awarded = awardedOf(peer);
    if (!peerBase || !awarded) return [];
    const ratio = awarded / peerBase.value;
    if (ratio < SANE_RATIO.min || ratio > SANE_RATIO.max) return [];
    return [
      {
        award: {
          projectNumber: peer.projectNumber ?? null,
          title: peer.title,
          vendor: peer.contracts?.find((contract) => contract.vendor)?.vendor ?? null,
          base: peerBase.value,
          awarded,
          discount: 1 - ratio,
        } satisfies PastAward,
        ratio,
        score: similarity(wanted, skillsOf(textOf(peer))),
        sameKind: workKindOf(peer.title) === kind,
      },
    ];
  });

  const close = scored.filter((peer) => peer.sameKind && peer.score >= CLOSE_ENOUGH);
  const broad = close.length < MIN_PEERS;
  const peers = broad ? scored.filter((peer) => peer.score > 0) : close;

  if (peers.length < MIN_PEERS) {
    empty.peerCount = peers.length;
    empty.notes.push(`มีโครงการลักษณะใกล้เคียงที่ประกาศผลผู้ชนะแล้วเพียง ${peers.length} รายการ ยังไม่พอสำหรับแนะนำราคา`);
    return empty;
  }

  const ratios = peers.map((peer) => peer.ratio).sort((a, b) => a - b);
  const medianRatio = median(ratios);
  const averageRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  const medianDiscount = 1 - medianRatio;
  const competition = competitionOf(medianDiscount);

  const point = (label: PricePoint["label"], ratio: number): PricePoint => {
    const price = Math.round((base.value * ratio) / ROUND_TO) * ROUND_TO;
    return { label, price, ratio, winChance: chanceAt(ratios, price / base.value) };
  };
  const pricePoints = [
    point("aggressive", percentile(ratios, 0.25)),
    point("recommended", medianRatio),
    point("conservative", percentile(ratios, 0.75)),
  ];

  const wins = new Map<string, number>();
  for (const { award } of peers) {
    if (award.vendor) wins.set(award.vendor, (wins.get(award.vendor) ?? 0) + 1);
  }
  const topWinners = [...wins.entries()]
    .map(([vendor, count]) => ({ vendor, wins: count }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 3);

  const recentAwards = [...peers]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((peer) => peer.award);

  const notes = [
    broad
      ? `เทียบแบบกว้างกับโครงการด้านไอทีที่ประกาศผู้ชนะแล้ว ${peers.length} รายการ เพราะมีโครงการลักษณะเดียวกันไม่มากพอ`
      : `เทียบกับโครงการลักษณะเดียวกันที่ประกาศผู้ชนะแล้ว ${peers.length} รายการ`,
    `ผู้ชนะเสนอต่ำกว่า${base.kind === "reference" ? "ราคากลาง" : "วงเงิน"}เฉลี่ย ${percent(1 - averageRatio)} (ค่ากลาง ${percent(medianDiscount)})`,
    competition === "blue"
      ? "ผู้ชนะส่วนใหญ่เสนอราคาใกล้ราคากลาง แข่งขันด้านราคาไม่สูง (Blue Ocean)"
      : competition === "red"
        ? "ผู้ชนะต้องตัดราคาลงมาก แข่งขันด้านราคาสูง (Red Ocean)"
        : "การแข่งขันด้านราคาอยู่ในระดับปานกลาง",
    `ราคาแนะนำ ${formatBaht(pricePoints[1].price)} — โอกาสชนะเป็นการประมาณจากราคาที่ชนะในอดีตเท่านั้น ไม่รวมคะแนนคุณภาพหรือจำนวนคู่แข่ง`,
  ];

  return {
    status: "ok",
    base: base.value,
    baseKind: base.kind,
    peerCount: peers.length,
    broad,
    medianDiscount,
    averageDiscount: 1 - averageRatio,
    competition,
    distinctWinners: wins.size,
    topWinners,
    pricePoints,
    recentAwards,
    notes,
  };
}
