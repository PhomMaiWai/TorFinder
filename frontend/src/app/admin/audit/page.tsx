import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AdminPageShell } from "@/components/layout/admin-page";
import { type AuditFeedQuery, fetchAuditFeed } from "@/lib/admin-api";
import { thaiDateTime } from "@/lib/datetime";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10";
const labelCls = "mb-1 block text-xs font-medium text-ink-muted";

/** A day a date input sends; anything else in the address — a typo, a stale link — is ignored. */
const asDay = (value: string | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

/** The same filters with another page number, for the previous/next links. */
function pageHref(filters: AuditFeedQuery, page: number): string {
  const params = new URLSearchParams(
    Object.entries({ ...filters, page }).flatMap(([key, value]) => (value ? [[key, String(value)]] : [])),
  );
  return `/admin/audit?${params}`;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; from?: string; to?: string; page?: string }>;
}) {
  const params = await searchParams;
  const filters: AuditFeedQuery = {
    action: params.action || undefined,
    actor: params.actor?.trim() || undefined,
    from: asDay(params.from),
    to: asDay(params.to),
  };
  const page = Math.max(1, Number(params.page) || 1);

  const [{ items, total, pageSize, actions }, t] = await Promise.all([
    fetchAuditFeed({ ...filters, page }),
    getTranslations("AdminAuditPage"),
  ]);
  const filtered = Object.values(filters).some(Boolean);
  const lastPage = page * pageSize >= total;

  return (
    <AdminPageShell title="Audit Log" description={t("description")}>
      <div className="space-y-4">
        {/* A plain GET form: the filters live in the address, so a filtered view can be linked to. */}
        <form
          method="get"
          action="/admin/audit"
          className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.2fr_1fr_1fr_auto]"
        >
          <div>
            <label htmlFor="audit-action" className={labelCls}>
              {t("filterAction")}
            </label>
            <select id="audit-action" name="action" defaultValue={filters.action ?? ""} className={inputCls}>
              <option value="">{t("filterAllActions")}</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="audit-actor" className={labelCls}>
              {t("filterActor")}
            </label>
            <input
              id="audit-actor"
              name="actor"
              type="search"
              defaultValue={filters.actor ?? ""}
              placeholder={t("filterActorPlaceholder")}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="audit-from" className={labelCls}>
              {t("filterFrom")}
            </label>
            <input id="audit-from" name="from" type="date" defaultValue={filters.from ?? ""} className={inputCls} />
          </div>
          <div>
            <label htmlFor="audit-to" className={labelCls}>
              {t("filterTo")}
            </label>
            <input id="audit-to" name="to" type="date" defaultValue={filters.to ?? ""} className={inputCls} />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ink/90"
            >
              {t("filterApply")}
            </button>
            {filtered && (
              <Link
                href="/admin/audit"
                className="flex h-10 items-center rounded-lg px-3 text-sm font-medium text-ink-muted hover:bg-surface-alt hover:text-ink"
              >
                {t("filterClear")}
              </Link>
            )}
          </div>
        </form>

        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          {items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              {filtered ? t("noMatches") : t("emptyState")}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((log) => (
                <div
                  key={`${log.date}-${log.action}-${log.actor}`}
                  className="flex items-center gap-4 px-5 py-4 max-sm:flex-col max-sm:items-start"
                >
                  <span
                    className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${
                      log.type === "auto"
                        ? "bg-accent-soft text-accent-text"
                        : "bg-surface-alt text-ink-muted"
                    }`}
                  >
                    {log.type === "auto" ? t("typeAuto") : t("typeManual")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{log.action}</p>
                    <p className="text-xs text-ink-muted">{log.detail}</p>
                  </div>

                  <div className="shrink-0 text-right max-sm:text-left">
                    <p className="text-xs font-medium break-words text-ink">{log.actor}</p>
                    <p className="text-xs text-ink-muted">{thaiDateTime(log.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <nav aria-label={t("pagination")} className="flex items-center justify-between">
          <Link
            href={pageHref(filters, Math.max(1, page - 1))}
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
            href={pageHref(filters, page + 1)}
            aria-disabled={lastPage}
            className={`flex items-center gap-1 text-sm font-medium ${
              lastPage ? "pointer-events-none text-ink-subtle" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t("next")}
            <ChevronRight size={16} />
          </Link>
        </nav>
      </div>
    </AdminPageShell>
  );
}
