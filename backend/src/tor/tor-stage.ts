import { ProcurementStage, STAGE, TOR_STAGES } from "./tor.constants";

export type TorStage = (typeof TOR_STAGES)[number];

/** One step of a project's journey, for the timeline a reader sees. */
export type TimelineEntry = {
  stage: TorStage;
  /** The paper trail (or the record itself) shows the project got here. */
  reached: boolean;
  /**
   * The furthest stage the project is known to have reached — not necessarily
   * the stage this record was imported as: a draft whose project has since
   * been awarded is at the award. Exactly one entry has it.
   */
  current: boolean;
  /** ISO timestamp of the earliest announcement for the stage, when one has a date. */
  publishedAt: string | null;
};

type Dated = { label: string; publishedAt?: Date | string | null };

/**
 * A notice that withdraws another ("ยกเลิกประกาศเชิญชวน") says nothing about
 * the project reaching a stage, so it counts for none.
 */
const WITHDRAWAL = /^\s*ยกเลิก/;

/**
 * Which stage an announcement's label belongs to, null for one that belongs to
 * none (a withdrawal, an attachment). The portals print no stage, only a title,
 * so this reads the title. Order matters: a draft invitation ("ร่างประกาศ
 * เชิญชวน") is a draft, not an invitation, and "ประกาศผู้ชนะ" must not be
 * mistaken for an invitation just because it starts with ประกาศ.
 */
const STAGE_BY_LABEL: [RegExp, TorStage][] = [
  [/แผนการจัดซื้อ|แผนการจัดจ้าง/, STAGE.plan],
  [/ราคากลาง/, STAGE.price],
  [/ร่าง/, STAGE.draft],
  [/ผู้ชนะ|ผู้ได้รับการคัดเลือก/, STAGE.award],
  [/เชิญชวน/, STAGE.invitation],
];

export function stageOfAnnouncement(label: string): TorStage | null {
  if (WITHDRAWAL.test(label)) return null;
  return STAGE_BY_LABEL.find(([pattern]) => pattern.test(label))?.[1] ?? null;
}

export type TimelineFields = {
  stage: TorStage;
  documents?: Dated[];
  /** A published ราคากลาง is evidence the price stage happened even with no notice for it. */
  referencePrice?: number;
  /** e-GP's own step for the project, which can be well past this record's stage. */
  procurementStep?: { stage: ProcurementStage | null } | null;
  /** A winner is on file for this project number, on any portal (awardedProjectNumbers). */
  awarded?: boolean;
};

/** e-GP steps that place the project at one of the five stages; the rest place it nowhere. */
const STAGE_BY_STEP: Partial<Record<ProcurementStage, TorStage>> = {
  invitation: STAGE.invitation,
  awarded: STAGE.award,
  contract: STAGE.award,
};

/** The later of two stages in lifecycle order. */
function later(a: TorStage, b: TorStage | null | undefined): TorStage {
  return b && TOR_STAGES.indexOf(b) > TOR_STAGES.indexOf(a) ? b : a;
}

/**
 * The five stages in lifecycle order, each marked reached or not. Only evidence
 * marks a stage reached — an announcement of that kind, the record's own stage,
 * or (for the price) a reference price on file. A stage with none is left
 * unreached rather than inferred from the ones around it: a project can be
 * awarded with its plan never published, and the timeline should say so.
 */
export function buildTimeline(tor: TimelineFields): TimelineEntry[] {
  const earliest = new Map<TorStage, number | null>();
  for (const doc of tor.documents ?? []) {
    const stage = stageOfAnnouncement(doc.label);
    if (!stage) continue;
    const time = doc.publishedAt ? new Date(doc.publishedAt).getTime() : NaN;
    const known = earliest.get(stage);
    if (!earliest.has(stage)) earliest.set(stage, Number.isNaN(time) ? null : time);
    else if (!Number.isNaN(time) && (known == null || time < known)) earliest.set(stage, time);
  }

  // Where the project is now: the furthest stage any evidence puts it at — the
  // same evidence biddingOf reads to call a record closed, so the timeline and
  // the "ประกาศผู้ชนะแล้ว" badge never disagree about the same project.
  let current: TorStage = tor.stage;
  for (const stage of earliest.keys()) current = later(current, stage);
  const step = tor.procurementStep?.stage;
  if (step) current = later(current, STAGE_BY_STEP[step]);
  if (tor.awarded) current = later(current, STAGE.award);

  return TOR_STAGES.map((stage) => {
    const time = earliest.get(stage) ?? null;
    return {
      stage,
      reached:
        earliest.has(stage) ||
        stage === tor.stage ||
        stage === current ||
        (stage === STAGE.price && tor.referencePrice != null),
      current: stage === current,
      publishedAt: time == null ? null : new Date(time).toISOString(),
    };
  });
}
