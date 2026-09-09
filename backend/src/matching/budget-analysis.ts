import { skillsOf } from "./matching.scoring";

/** What the analysis reads from a record; structural so a TorDoc fits as-is. */
export type BudgetPeer = {
  title: string;
  summary: string;
  tags: string[];
  budgetAmount?: number;
};

export type BudgetAssessment = {
  status: "สูงกว่าปกติ" | "ต่ำกว่าปกติ" | "ปกติ" | "ไม่ประเมิน";
  /** The budget being judged, in baht. */
  budget: number | null;
  /** Median of comparable announcements, and how many there were. */
  median: number | null;
  peerCount: number;
  /** budget / median — 1 is exactly typical. */
  ratio: number | null;
  /** Plain-Thai explanation of the verdict, always safe to show a citizen. */
  notes: string[];
};

/**
 * Below this many comparable projects the median says more about the sample
 * than about the price, so the announcement is left unjudged rather than
 * labelled on thin evidence.
 */
const MIN_PEERS = 5;

/**
 * Where a budget has to land to be worth a second look. Procurement budgets are
 * heavy-tailed — a handful of hundred-million baht platforms sit alongside
 * hundred-thousand baht jobs — so a fixed multiple of the median flags ordinary
 * projects by the dozen. Percentiles adapt to whatever the real spread is, and
 * by construction only the extremes get called out.
 */
const HIGH_PERCENTILE = 0.9;
const LOW_PERCENTILE = 0.1;

/** A budget in the document differing from the portal's by more than this is worth noting. */
const RESTATEMENT_TOLERANCE = 0.05;

function percentile(sorted: number[], fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))));
  return sorted[index];
}

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/** Share of peers this budget is at or above, 0-1. */
function rankOf(sorted: number[], value: number): number {
  return sorted.filter((peer) => peer <= value).length / sorted.length;
}

const BAHT = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

/**
 * How alike two announcements are, 0-1, by the skills their wording implies.
 * Plain overlap is far too generous — nearly every IT announcement shares at
 * least one skill with every other — so similarity is the share of skills the
 * two have in common out of all skills either mentions.
 */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const shared = [...a].filter((skill) => b.has(skill)).length;
  return shared / new Set([...a, ...b]).size;
}

/** Announcements alike enough that comparing prices means something. */
const CLOSE_ENOUGH = 0.5;

/**
 * What is being bought, which sets the price class before any skill does:
 * building a system, keeping one running, buying licences for one, or advice
 * about one are four different markets. Comparing a maintenance contract
 * against platform builds is how a perfectly ordinary price ends up flagged.
 */
const WORK_KINDS: Record<string, string[]> = {
  maintain: ["บำรุงรักษา", "ดูแลระบบ", "ซ่อม", "แก้ไขระบบ", "ต่ออายุ"],
  license: ["ซื้อสิทธิ์", "ลิขสิทธิ์", "เช่าใช้", "subscription"],
  consult: ["ที่ปรึกษา", "ศึกษา", "แผนแม่บท"],
  build: ["พัฒนา", "จัดทำ", "จ้างทำ", "ออกแบบ", "ติดตั้ง", "ปรับปรุงระบบ"],
};

function workKindOf(text: string): string {
  const haystack = text.toLowerCase();
  // Order matters: "ปรับปรุงระบบบำรุงรักษา" is maintenance, not a build.
  for (const [kind, terms] of Object.entries(WORK_KINDS)) {
    if (terms.some((term) => haystack.includes(term))) return kind;
  }
  return "other";
}

type PeerSet = { budgets: number[]; broad: boolean };

/**
 * Comparable announcements, preferring close matches. If too few projects are
 * genuinely alike, the comparison widens to anything sharing a skill and says
 * so, rather than silently judging a maintenance contract against platform
 * builds.
 */
function peersOf(target: BudgetPeer, all: BudgetPeer[]): PeerSet {
  const wanted = skillsOf(`${target.title} ${target.summary} ${target.tags.join(" ")}`);
  const kind = workKindOf(target.title);

  const scored = all.flatMap((peer) => {
    if (!peer.budgetAmount || peer === target) return [];
    const skills = skillsOf(`${peer.title} ${peer.summary} ${peer.tags.join(" ")}`);
    return [
      {
        budget: peer.budgetAmount,
        score: similarity(wanted, skills),
        sameKind: workKindOf(peer.title) === kind,
      },
    ];
  });

  const close = scored.filter((peer) => peer.sameKind && peer.score >= CLOSE_ENOUGH);
  if (close.length >= MIN_PEERS) return { budgets: close.map((p) => p.budget), broad: false };

  const loose = scored.filter((peer) => peer.score > 0);
  return { budgets: loose.map((p) => p.budget), broad: true };
}

/**
 * Judges one announcement's budget against comparable ones. Deliberately
 * statistical rather than a model's opinion: a number a reader can check beats
 * a verdict they have to trust, and the wording stays an observation — an
 * unusual budget is a reason to look, never an accusation.
 */
export function assessBudget(
  target: BudgetPeer & { documentBudget?: number | null },
  all: BudgetPeer[],
): BudgetAssessment {
  const budget = target.budgetAmount ?? null;
  const notes: string[] = [];

  // The document's own figure, when a model read one, is worth surfacing before
  // anything else: the two disagreeing is itself the finding.
  if (budget && target.documentBudget && Math.abs(target.documentBudget - budget) / budget > RESTATEMENT_TOLERANCE) {
    notes.push(
      `วงเงินในเอกสาร (${BAHT.format(target.documentBudget)}) ต่างจากที่ประกาศไว้ในระบบ (${BAHT.format(budget)})`,
    );
  }

  if (!budget) {
    notes.push("ประกาศนี้ไม่ได้ระบุวงเงิน จึงประเมินไม่ได้");
    return { status: "ไม่ประเมิน", budget, median: null, peerCount: 0, ratio: null, notes };
  }

  const { budgets: peers, broad } = peersOf(target, all);
  if (peers.length < MIN_PEERS) {
    notes.push(`มีโครงการลักษณะใกล้เคียงเพียง ${peers.length} รายการ ยังไม่พอสำหรับเปรียบเทียบ`);
    return { status: "ไม่ประเมิน", budget, median: null, peerCount: peers.length, ratio: null, notes };
  }

  const sorted = [...peers].sort((a, b) => a - b);
  const mid = median(sorted);
  const rank = rankOf(sorted, budget);
  const status =
    budget > percentile(sorted, HIGH_PERCENTILE)
      ? "สูงกว่าปกติ"
      : budget < percentile(sorted, LOW_PERCENTILE)
        ? "ต่ำกว่าปกติ"
        : "ปกติ";

  notes.push(
    broad
      ? `เทียบแบบกว้างกับโครงการด้านไอที ${peers.length} รายการ (ค่ากลาง ${BAHT.format(mid)}) เพราะมีโครงการลักษณะใกล้เคียงกันไม่มากพอ`
      : `เทียบกับโครงการลักษณะเดียวกัน ${peers.length} รายการ ค่ากลางอยู่ที่ ${BAHT.format(mid)}`,
    status === "ปกติ"
      ? `วงเงินอยู่ในช่วงปกติ (สูงกว่าประมาณ ${Math.round(rank * 100)}% ของโครงการที่นำมาเทียบ)`
      : `วงเงินอยู่ในกลุ่ม${status === "สูงกว่าปกติ" ? "สูงสุด" : "ต่ำสุด"} 10% ของโครงการลักษณะเดียวกัน — เป็นข้อสังเกตให้ตรวจสอบเพิ่มเติม ไม่ใช่ข้อสรุปว่ามีความผิดปกติ`,
  );

  return { status, budget, median: mid, peerCount: peers.length, ratio: budget / mid, notes };
}
