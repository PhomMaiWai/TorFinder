import { AdminPageShell } from "@/components/layout/admin-page";
import { AUDIT_LOG } from "@/data/admin";

export default function AdminAuditPage() {
  return (
    <AdminPageShell title="Audit Log" description="ประวัติการทำงานของระบบและผู้ดูแลระบบทั้งหมด">
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="divide-y divide-border">
          {AUDIT_LOG.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-4 px-5 py-4 max-sm:flex-col max-sm:items-start"
            >
              <span
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${
                  log.type === "auto"
                    ? "bg-accent-soft text-accent-text"
                    : "bg-surface-alt text-ink-muted"
                }`}
              >
                {log.type === "auto" ? "อัตโนมัติ" : "ผู้ดูแล"}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{log.action}</p>
                <p className="text-xs text-ink-muted">{log.detail}</p>
              </div>

              <div className="shrink-0 text-right max-sm:text-left">
                <p className="text-xs font-medium text-ink">{log.actor}</p>
                <p className="text-xs text-ink-muted">{log.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminPageShell>
  );
}
