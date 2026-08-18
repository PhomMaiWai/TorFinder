import { Bookmark, Building2, Clock } from "lucide-react";
import Link from "next/link";

import type { Opportunity } from "@/types/opportunity";

type OpportunityCardProps = {
  opportunity: Opportunity;
  isSaved: boolean;
  onSaveToggle: (id: number) => void;
};

function MatchBadge({ score }: { score: number }) {
  const cls =
    score >= 90
      ? "bg-accent-soft text-accent-text"
      : score >= 80
        ? "bg-warn-soft text-warn"
        : "bg-surface-alt text-ink-muted";
  return (
    <span className={`shrink-0 rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${cls}`}>
      {score}
      <span className="ml-0.5 text-xs font-normal opacity-60">%</span>
    </span>
  );
}

export function OpportunityCard({
  opportunity,
  isSaved,
  onSaveToggle,
}: OpportunityCardProps) {
  const {
    id, title, agency, budget, daysLeft,
    match, tags, stage, summary, isNew,
  } = opportunity;

  const isUrgent = daysLeft <= 7;
  const isPublished = stage === "ประกาศ TOR";
  const isFeedbackOpen = stage === "เปิดรับฟังความคิดเห็น";

  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-white transition-all hover:border-accent/30 hover:shadow-sm">
      {/* Left urgency / status bar */}
      <div
        className={`absolute inset-y-0 left-0 w-[3px] ${
          isUrgent
            ? "bg-danger"
            : isFeedbackOpen
              ? "bg-success"
              : "bg-transparent"
        }`}
        aria-hidden
      />

      <div className="p-5 pl-6">
        {/* Row 1: badges + match */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                isPublished
                  ? "bg-accent-soft text-accent-text"
                  : "bg-warn-soft text-warn"
              }`}
            >
              {stage}
            </span>
            {isNew && (
              <span className="rounded-md bg-surface-alt px-2 py-0.5 text-xs font-medium text-ink-muted">
                ใหม่
              </span>
            )}
            {isFeedbackOpen && (
              <span className="flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
                <span className="size-1 rounded-full bg-success" />
                รับความคิดเห็น
              </span>
            )}
          </div>
          <MatchBadge score={match} />
        </div>

        {/* Row 2: title */}
        <Link href={`/tor/${id}`}>
          <h3 className="mt-3 text-base font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
            {title}
          </h3>
        </Link>

        {/* Row 3: agency · budget · deadline — all inline */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-muted">
          <span className="flex items-center gap-1">
            <Building2 size={12} className="shrink-0" />
            {agency}
          </span>
          <span aria-hidden>·</span>
          <span className="font-medium text-ink">{budget}</span>
          <span aria-hidden>·</span>
          <span
            className={`flex items-center gap-1 ${
              isUrgent ? "font-semibold text-danger" : ""
            }`}
          >
            <Clock size={12} className="shrink-0" />
            เหลือ {daysLeft} วัน
          </span>
        </div>

        {/* Row 4: summary */}
        <p className="mt-2.5 text-sm leading-relaxed text-ink-muted line-clamp-2">
          {summary}
        </p>

        {/* Row 5: tags + actions */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-border px-2 py-0.5 text-xs text-ink-muted"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => onSaveToggle(id)}
              className={`grid size-8 place-items-center rounded-lg border transition-colors ${
                isSaved
                  ? "border-accent/30 bg-accent-soft text-accent"
                  : "border-border text-ink-muted hover:border-accent/30 hover:bg-accent-soft hover:text-accent"
              }`}
              aria-label={isSaved ? "ยกเลิกบันทึก" : "บันทึก"}
            >
              <Bookmark size={13} fill={isSaved ? "currentColor" : "none"} />
            </button>
            <Link
              href={`/tor/${id}`}
              className="flex h-8 items-center rounded-lg bg-accent px-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
            >
              ดูรายละเอียด
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
