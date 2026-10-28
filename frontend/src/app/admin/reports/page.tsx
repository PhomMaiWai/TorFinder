import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ReportList } from "@/components/admin/report-list";
import { AdminPageShell } from "@/components/layout/admin-page";
import { fetchReports, type ReportStatus } from "@/lib/admin-api";
import { REPORT_REASONS } from "@/lib/report-reasons";

const TABS = ["open", "resolved", "all"] as const;
type Tab = (typeof TABS)[number];

/** Anything else in the address — a typo, a stale link — opens on what still needs doing. */
const asTab = (value: string | undefined): Tab => (TABS.includes(value as Tab) ? (value as Tab) : "open");

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const tab = asTab(params.status);
  const page = Math.max(1, Number(params.page) || 1);
  const status: ReportStatus | undefined = tab === "all" ? undefined : tab;

  const [{ items, total, pageSize }, t, reasons] = await Promise.all([
    fetchReports(status, page),
    getTranslations("AdminReportsPage"),
    getTranslations("ReportProblem"),
  ]);
  const lastPage = page * pageSize >= total;

  return (
    <AdminPageShell title={t("title")} description={t("description")}>
      <div className="space-y-4">
        <nav aria-label={t("tabsLabel")} className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {TABS.map((id) => (
            <Link
              key={id}
              href={`/admin/reports?status=${id}`}
              aria-current={tab === id ? "page" : undefined}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                tab === id ? "bg-ink text-white" : "text-ink-muted hover:bg-surface-alt hover:text-ink"
              }`}
            >
              {t(`tab_${id}`)}
            </Link>
          ))}
        </nav>

        <ReportList
          items={items}
          labels={{
            open: t("statusOpen"),
            resolved: t("statusResolved"),
            reasons: Object.fromEntries(REPORT_REASONS.map((reason) => [reason, reasons(`reason_${reason}`)])) as Record<
              (typeof REPORT_REASONS)[number],
              string
            >,
            guest: t("guest"),
            viewTor: t("viewTor"),
            resolve: t("resolve"),
            reopen: t("reopen"),
            resolvedBy: t.raw("resolvedBy") as string,
            missingTor: t("missingTor"),
            empty: tab === "open" ? t("emptyOpen") : t("empty"),
          }}
        />

        {total > pageSize && (
          <nav aria-label={t("pagination")} className="flex items-center justify-between">
            <Link
              href={`/admin/reports?status=${tab}&page=${Math.max(1, page - 1)}`}
              aria-disabled={page <= 1}
              className={`flex items-center gap-1 text-sm font-medium ${
                page <= 1 ? "pointer-events-none text-ink-subtle" : "text-ink-muted hover:text-ink"
              }`}
            >
              <ChevronLeft size={16} />
              {t("previous")}
            </Link>
            <span className="text-sm text-ink-muted">{t("pageOf", { page, total })}</span>
            <Link
              href={`/admin/reports?status=${tab}&page=${page + 1}`}
              aria-disabled={lastPage}
              className={`flex items-center gap-1 text-sm font-medium ${
                lastPage ? "pointer-events-none text-ink-subtle" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t("next")}
              <ChevronRight size={16} />
            </Link>
          </nav>
        )}
      </div>
    </AdminPageShell>
  );
}
