import { STAGE, TOR_STAGES } from "./tor.constants";

export type TorStage = (typeof TOR_STAGES)[number];

/** One step of a project's journey, for the timeline a reader sees. */
export type TimelineEntry = {
  stage: TorStage;
  /** The paper trail (or the record itself) shows the project got here. */
  reached: boolean;
  /** The stage this record is. Exactly one entry has it. */
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
};

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

  return TOR_STAGES.map((stage) => {
    const time = earliest.get(stage) ?? null;
    return {
      stage,
      reached:
        earliest.has(stage) ||
        stage === tor.stage ||
        (stage === STAGE.price && tor.referencePrice != null),
      current: stage === tor.stage,
      publishedAt: time == null ? null : new Date(time).toISOString(),
    };
  });
}
