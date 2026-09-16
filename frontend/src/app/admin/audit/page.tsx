import { getTranslations } from "next-intl/server";

import { AdminPageShell } from "@/components/layout/admin-page";
import { fetchAuditFeed } from "@/lib/admin-api";
import { thaiDateTime } from "@/lib/datetime";

export default async function AdminAuditPage() {
  const [entries, t] = await Promise.all([fetchAuditFeed(), getTranslations("AdminAuditPage")]);

  return (
    <AdminPageShell title="Audit Log" description={t("description")}>
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {entries.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">{t("emptyState")}</p>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((log) => (
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
    </AdminPageShell>
  );
}
