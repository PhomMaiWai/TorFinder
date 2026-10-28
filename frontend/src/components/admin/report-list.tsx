"use client";

import { Check, ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { reopenReport, resolveReport } from "@/app/admin/reports/actions";
import type { TorReport } from "@/lib/admin-api";
import type { ReportReason } from "@/lib/report-reasons";

export type ReportListLabels = {
  open: string;
  resolved: string;
  reasons: Record<ReportReason, string>;
  guest: string;
  viewTor: string;
  resolve: string;
  reopen: string;
  /** "Resolved by {who} on {date}" — a template, since a server page can't hand a function down. */
  resolvedBy: string;
  missingTor: string;
  empty: string;
};

const DATE = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

/**
 * The admins' list of "report a problem" entries (FR-21). Each one names the
 * TOR it is about, opens it, and is resolved once the record has been checked
 * — or reopened if it was closed too soon. Both are logged by the backend.
 */
export function ReportList({ items, labels }: { items: TorReport[]; labels: ReportListLabels }) {
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-ink-muted">
        {labels.empty}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-4 max-sm:flex-col">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    item.status === "open" ? "bg-warn-soft text-warn" : "bg-success-soft text-success"
                  }`}
                >
                  {item.status === "open" ? labels.open : labels.resolved}
                </span>
                <span className="rounded-md bg-surface-alt px-2.5 py-1 text-xs font-medium text-ink">
                  {labels.reasons[item.reason] ?? item.reason}
                </span>
                <span className="text-xs text-ink-muted">
                  {item.reporter
                    ? `${item.reporter.name} (${item.reporter.email})`
                    : item.contact
                      ? `${labels.guest} · ${item.contact}`
                      : labels.guest}
                  {" · "}
                  {DATE.format(new Date(item.createdAt))}
                </span>
              </div>

              <p className="text-sm font-medium text-ink">{item.torTitle ?? labels.missingTor}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{item.message}</p>

              {item.status === "resolved" && item.resolvedBy && item.resolvedAt && (
                <p className="mt-2 text-xs text-ink-subtle">
                  {labels.resolvedBy
                    .replace("{who}", item.resolvedBy)
                    .replace("{date}", DATE.format(new Date(item.resolvedAt)))}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {item.torTitle && (
                <Link
                  href={`/tor/${item.torId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-alt hover:text-ink"
                >
                  <ExternalLink size={14} />
                  {labels.viewTor}
                </Link>
              )}
              {item.status === "open" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => resolveReport(item.id))}
                  className="flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50"
                >
                  <Check size={14} />
                  {labels.resolve}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => reopenReport(item.id))}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-alt hover:text-ink disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  {labels.reopen}
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
