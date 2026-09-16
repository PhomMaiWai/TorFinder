import { Activity, AlertTriangle, Bell, Check, FileText, Plus, ScanSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AdminPageShell } from "@/components/layout/admin-page";
import { fetchAdminOverview } from "@/lib/activity-api";
import { thaiDateTime, timeAgo } from "@/lib/datetime";

export default async function AdminOverviewPage() {
  const [overview, t] = await Promise.all([
    fetchAdminOverview(),
    getTranslations("AdminOverviewPage"),
  ]);

  const { pipeline, extraction, runs, notifications } = overview;
  const readable = extraction.done + extraction.failed + extraction.pending;

  const metrics = [
    {
      label: t("pipelineStatusLabel"),
      value: pipeline.ok ? t("pipelineOk") : t("pipelineFailing"),
      sub: pipeline.lastRunAt ? t("lastRunAt", { when: timeAgo(pipeline.lastRunAt) }) : t("neverRun"),
      icon: Activity,
      tone: pipeline.ok ? "success" : "danger",
    },
    {
      label: t("newTodayLabel"),
      value: String(pipeline.importedToday),
      sub: t("agencyCount", { count: pipeline.agencies }),
      icon: FileText,
      tone: "neutral",
    },
    {
      label: t("extractedLabel"),
      value: `${extraction.done} / ${readable}`,
      sub: t("extractionPending", { count: extraction.pending }),
      icon: ScanSearch,
      tone: "neutral",
    },
    {
      label: t("notificationsLabel"),
      value: String(notifications),
      sub: t("notificationsSub"),
      icon: Bell,
      tone: "neutral",
    },
  ] as const;

  // Every bar is read against the busiest run, so a quiet day stays visible
  // instead of collapsing to nothing next to a big import.
  const busiest = Math.max(...[extraction.done, extraction.failed, extraction.pending], 1);
  const breakdown = [
    { label: t("extractionDone"), count: extraction.done },
    { label: t("extractionFailed"), count: extraction.failed },
    { label: t("extractionWaiting"), count: extraction.pending },
  ];

  return (
    <AdminPageShell title={t("title")} description={t("description")}>
      <div className="space-y-6">
        <div className="flex justify-end gap-3">
          <Link
            href="/admin/tor"
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-alt"
          >
            <FileText size={16} />
            {t("torListCta")}
          </Link>
          <Link
            href="/admin/tor/new"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            <Plus size={16} />
            {t("createTorCta")}
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, sub, icon: Icon, tone }) => (
            <div key={label} className="rounded-xl border border-border bg-white p-5">
              <div
                className={`mb-3 grid size-9 place-items-center rounded-lg ${
                  tone === "success"
                    ? "bg-success-soft"
                    : tone === "danger"
                      ? "bg-danger-soft"
                      : "bg-surface-alt"
                }`}
              >
                <Icon
                  size={18}
                  className={
                    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink"
                  }
                />
              </div>
              <p className="text-xs text-ink-muted">{label}</p>
              <p
                className={`mt-1 text-xl font-bold ${
                  tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink"
                }`}
              >
                {value}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>
            </div>
          ))}
        </div>

        {/* Import history */}
        <div className="rounded-xl border border-border bg-white p-6">
          <h2 className="mb-4 text-base font-bold text-ink">{t("scrapeHistoryHeading")}</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noRunsYet")}</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={`${run.source}-${run.at}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm max-sm:flex-col max-sm:items-start"
                >
                  <span className="text-ink-muted">
                    {thaiDateTime(run.at)} · {run.source}
                  </span>
                  <span className="font-medium text-ink">
                    {run.imported > 0 ? t("newItemsCount", { count: run.imported }) : t("noNewItems")}
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                      run.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                    }`}
                  >
                    {run.ok ? <Check size={12} /> : <AlertTriangle size={12} />}
                    {run.ok ? t("runOk") : t("runFailed")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* What the model has read */}
        <div className="rounded-xl border border-border bg-white p-6">
          <h2 className="mb-4 text-base font-bold text-ink">{t("classificationHeading")}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {breakdown.map(({ label, count }) => (
              <div key={label} className="rounded-lg border border-border p-4">
                <p className="text-xs text-ink-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{count}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.round((count / busiest) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {readable > 0 ? Math.round((count / readable) * 100) : 0}%
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}
