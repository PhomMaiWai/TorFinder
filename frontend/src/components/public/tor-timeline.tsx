import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import type { TimelineEntry } from "@/types/tor";

const DATE = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

function thaiDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : DATE.format(date);
}

function circleCls(entry: TimelineEntry): string {
  if (entry.current) return "bg-accent text-white ring-4 ring-accent-soft";
  if (entry.reached) return "bg-success text-white";
  return "bg-surface-alt text-ink-subtle ring-1 ring-border";
}

function labelCls(entry: TimelineEntry): string {
  if (entry.current) return "text-accent";
  if (entry.reached) return "text-ink";
  return "text-ink-subtle";
}

/**
 * Left offset of each connector segment between the five (always five —
 * TOR_STAGES is fixed) equal-width stage columns, so a segment spans exactly
 * from one column's center to the next: column i is centered at 20i + 10%.
 */
const SEGMENT_LEFT = ["left-[10%]", "left-[30%]", "left-[50%]", "left-[70%]"];

/**
 * The project's journey through the five stages — plan, draft, reference
 * price, invitation, award — in lifecycle order. A stage is only marked
 * reached on evidence from the backend (buildTimeline), never inferred here:
 * a project can be awarded with its plan never published, and the reader
 * should see that gap rather than a timeline that papers over it.
 */
export function TorTimeline({ timeline }: { timeline: TimelineEntry[] }) {
  const t = useTranslations("TorDetailPage");

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="mb-5 text-base font-bold text-ink">{t("timelineHeading")}</h2>

      {/* Vertical on narrow screens: a horizontal stepper with five Thai
          labels has no room to breathe below sm. */}
      <ol className="flex flex-col sm:hidden">
        {timeline.map((entry, i) => (
          <li key={entry.stage} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${circleCls(entry)}`}>
                {entry.reached && !entry.current ? <Check size={14} /> : i + 1}
              </div>
              {i < timeline.length - 1 && (
                <div className={`my-1 w-0.5 flex-1 ${entry.reached ? "bg-success" : "bg-border"}`} />
              )}
            </div>
            <div className="min-w-0 pb-6 last:pb-0">
              <p className={`text-sm font-semibold leading-snug ${labelCls(entry)}`}>{entry.stage}</p>
              {thaiDate(entry.publishedAt) && (
                <p className="mt-0.5 text-xs text-ink-subtle">{thaiDate(entry.publishedAt)}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Horizontal on sm+: the track is drawn separately from the five grid
          cells it threads through, so its segments line up with the circles
          above each label however wide the section is — a flex row sized by
          its own circles and connectors has no way to also match a second,
          independently-sized grid of labels below it. */}
      <div className="hidden sm:block">
        <div className="relative h-7">
          <div className="absolute inset-x-[10%] top-1/2 h-0.5 -translate-y-1/2 bg-border" />
          {timeline.slice(0, -1).map((entry, i) =>
            entry.reached ? (
              <div
                key={entry.stage}
                className={`absolute top-1/2 h-0.5 w-[20%] -translate-y-1/2 bg-success ${SEGMENT_LEFT[i]}`}
              />
            ) : null,
          )}
          <div className="relative grid h-7 grid-cols-5">
            {timeline.map((entry, i) => (
              <div key={entry.stage} className="flex justify-center">
                <div className={`z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${circleCls(entry)}`}>
                  {entry.reached && !entry.current ? <Check size={14} /> : i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1">
          {timeline.map((entry) => {
            const date = thaiDate(entry.publishedAt);
            return (
              <div key={entry.stage} className="text-center">
                <p className={`text-xs font-semibold leading-snug ${labelCls(entry)}`}>{entry.stage}</p>
                {date && <p className="mt-0.5 text-2xs text-ink-subtle">{date}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
