import { Activity, AlertTriangle, Check, FileText, Plus, UserCheck, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AdminPageShell } from "@/components/layout/admin-page";
import { fetchEgpMetrics, fetchUserDirectory } from "@/lib/admin-api";
import { thaiDateTime, timeAgo } from "@/lib/datetime";

export default async function AdminOverviewPage() {
  const [metrics, users, t] = await Promise.all([
    fetchEgpMetrics(),
    fetchUserDirectory(),
    getTranslations("AdminOverviewPage"),
  ]);

  const pendingAccounts = users.filter((user) => user.status === "pending").length;
  const suspended = users.filter((user) => user.suspended).length;
  const healthy = metrics.status === "success" || metrics.status === "idle";

  const metricCards = [
    {
      label: t("pipelineStatusLabel"),
      value: t(`pipelineStatus.${metrics.status}`),
      sub: metrics.lastRunAt ? t("lastRunAt", { when: timeAgo(metrics.lastRunAt) }) : t("neverRun"),
      icon: Activity,
      tone: healthy ? "success" : "danger",
    },
    {
      label: t("newTodayLabel"),
      value: String(metrics.importedToday),
      sub: t("importedTodaySub"),
      icon: FileText,
      tone: "neutral",
    },
    {
      label: t("pendingAccountsLabel"),
      value: String(pendingAccounts),
      sub: pendingAccounts > 0 ? t("pendingAccountsSub") : t("pendingAccountsClear"),
      icon: UserCheck,
      tone: pendingAccounts > 0 ? "warn" : "neutral",
    },
    {
      label: t("totalUsersLabel"),
      value: String(users.length),
      sub: suspended > 0 ? t("suspendedSub", { count: suspended }) : t("noneSuspended"),
      icon: Users,
      tone: "neutral",
    },
  ] as const;

  const toneClasses = {
    success: { chip: "bg-success-soft", icon: "text-success", value: "text-success" },
    danger: { chip: "bg-danger-soft", icon: "text-danger", value: "text-danger" },
    warn: { chip: "bg-warn-soft", icon: "text-warn", value: "text-warn" },
    neutral: { chip: "bg-surface-alt", icon: "text-ink", value: "text-ink" },
  };

  return (
    <AdminPageShell title={t("title")} description={t("description")}>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-end gap-3">
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
          {metricCards.map(({ label, value, sub, icon: Icon, tone }) => (
            <div key={label} className="rounded-xl border border-border bg-surface p-5">
              <div className={`mb-3 grid size-9 place-items-center rounded-lg ${toneClasses[tone].chip}`}>
                <Icon size={18} className={toneClasses[tone].icon} />
              </div>
              <p className="text-xs text-ink-muted">{label}</p>
              <p className={`mt-1 text-xl font-bold ${toneClasses[tone].value}`}>{value}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>
            </div>
          ))}
        </div>

        {/* Sync history */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-base font-bold text-ink">{t("scrapeHistoryHeading")}</h2>
          {metrics.history.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noRunsYet")}</p>
          ) : (
            <div className="space-y-2">
              {metrics.history.map((run) => (
                <div
                  key={run.startedAt}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm max-sm:flex-col max-sm:items-start"
                >
                  <span className="text-ink-muted">{thaiDateTime(run.startedAt)}</span>
                  <span className="font-medium text-ink">
                    {run.status === "failed"
                      ? (run.error ?? t("runFailedDetail"))
                      : run.imported > 0
                        ? t("newItemsCount", { count: run.imported })
                        : t("noNewItems")}
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                      run.status === "success"
                        ? "bg-success-soft text-success"
                        : run.status === "partial"
                          ? "bg-warn-soft text-warn"
                          : "bg-danger-soft text-danger"
                    }`}
                  >
                    {run.status === "success" ? <Check size={12} /> : <AlertTriangle size={12} />}
                    {t(`runStatus.${run.status}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}
