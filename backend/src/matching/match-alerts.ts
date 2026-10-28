import { ObjectId } from "mongodb";

import { MatchAlertPhase, TorDoc } from "../database/database.service";
import { STAGE } from "../tor/tor.constants";

/** Plan, draft and reference price: the project is known, bids aren't open yet. */
const EARLY_STAGES: readonly string[] = [STAGE.plan, STAGE.draft, STAGE.price];

/** Which alert a record at this stage would be, or null once it is too late to bid. */
export function phaseOf(stage: string): MatchAlertPhase | null {
  if (stage === STAGE.invitation) return "invitation";
  return EARLY_STAGES.includes(stage) ? "early" : null;
}

/** One key per project across its stages; a record without a project number stands alone. */
export function projectKeyOf(tor: { _id: ObjectId; projectNumber?: string }): string {
  return tor.projectNumber ? `egp:${tor.projectNumber}` : `tor:${tor._id.toString()}`;
}

export const sentKey = (projectKey: string, phase: MatchAlertPhase) => `${projectKey}|${phase}`;

export type ScoredTor<T> = { tor: T; score: number; eligible?: boolean | null };

export type PlannedAlert<T> = {
  tor: T;
  score: number;
  phase: MatchAlertPhase;
  projectKey: string;
  /** The company already heard about this project at an earlier stage. */
  followsEarly: boolean;
};

/**
 * Which alerts one company should get from this batch: at or above its own
 * threshold, not ruled out by a hard requirement, not already sent for this
 * project and phase, best first, at most `max` — a large first sync must not
 * bury anyone. A project appearing twice in one batch (two stages at once)
 * is alerted once, at its latest phase.
 */
export function planAlerts<T extends Pick<TorDoc, "stage" | "projectNumber"> & { _id: ObjectId }>(
  scored: ScoredTor<T>[],
  { threshold, max, sent }: { threshold: number; max: number; sent: ReadonlySet<string> },
): PlannedAlert<T>[] {
  const byProject = new Map<string, PlannedAlert<T>>();
  for (const { tor, score, eligible } of scored) {
    const phase = phaseOf(tor.stage);
    if (!phase || score < threshold || eligible === false) continue;
    const projectKey = projectKeyOf(tor);
    if (sent.has(sentKey(projectKey, phase))) continue;

    const current = byProject.get(projectKey);
    if (current && (current.phase === "invitation" || phase === "early")) continue;
    byProject.set(projectKey, {
      tor,
      score,
      phase,
      projectKey,
      followsEarly: phase === "invitation" && sent.has(sentKey(projectKey, "early")),
    });
  }

  return [...byProject.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

/** The notification's title and message, worded for where the project stands. */
export function alertText(
  alert: Pick<PlannedAlert<Pick<TorDoc, "title" | "agency" | "budget" | "stage">>, "tor" | "score" | "phase" | "followsEarly">,
): { title: string; message: string } {
  const { tor, score, phase, followsEarly } = alert;
  const title =
    phase === "early"
      ? `โครงการใหม่ตรงกับบริษัทคุณ ${score}% (${tor.stage})`
      : followsEarly
        ? `เปิดรับข้อเสนอแล้ว — โครงการที่ตรงกับบริษัทคุณ ${score}%`
        : `TOR ใหม่ตรงกับบริษัทคุณ ${score}%`;
  const lead = phase === "early" ? "ยังไม่เปิดรับข้อเสนอ มีเวลาเตรียมตัว: " : "";
  return { title, message: `${lead}${tor.title} — ${tor.agency} (${tor.budget})` };
}
