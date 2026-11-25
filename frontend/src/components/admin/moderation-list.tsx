"use client";

import { Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { approveFeedback, rejectFeedback } from "@/app/admin/moderation/actions";
import { refreshAdminBadgeCounts } from "@/lib/use-admin-badge-counts";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/datetime";
import { valueLabel } from "@/lib/value-labels";
import type { TorFeedback } from "@/types/tor";

const STATUS_STYLES: Record<TorFeedback["status"], string> = {
  อนุมัติ: "bg-success-soft text-success",
  ปฏิเสธ: "bg-danger-soft text-danger",
  รอตรวจสอบ: "bg-warn-soft text-warn",
};

export function ModerationList({
  items,
  titles,
  labels,
}: {
  items: TorFeedback[];
  /** TOR id to title, so a comment can name what it is about. */
  titles: Record<string, string>;
  labels: { approve: string; reject: string; empty: string };
}) {
  const [isPending, startTransition] = useTransition();
  const tv = useTranslations("Values");
  const locale = useLocale() as Locale;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-ink-muted">
        {labels.empty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-4 max-sm:flex-col">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                >
                  {valueLabel(tv, "reviewStatus", item.status)}
                </span>
                <span className="text-xs text-ink-muted">
                  {item.author} · {formatDate(item.createdAt, locale)}
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                TOR:{" "}
                <span className="font-medium text-ink">{titles[item.torId] ?? item.torId}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.text}</p>
            </div>

            {item.status === "รอตรวจสอบ" && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  disabled={isPending}
                  onClick={() => startTransition(async () => {
                      await rejectFeedback(item.id);
                      await refreshAdminBadgeCounts();
                    })}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                >
                  <X size={14} />
                  {labels.reject}
                </button>
                <button
                  disabled={isPending}
                  onClick={() => startTransition(async () => {
                      await approveFeedback(item.id);
                      await refreshAdminBadgeCounts();
                    })}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
                >
                  <Check size={14} />
                  {labels.approve}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
