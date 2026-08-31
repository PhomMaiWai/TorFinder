import { AlertTriangle, Check } from "lucide-react";

import { AdminPageShell } from "@/components/layout/admin-page";
import { CLASSIFICATION_STATS, PIPELINE_METRICS, SCRAPE_HISTORY } from "@/data/admin";

export default function AdminOverviewPage() {
  return (
    <AdminPageShell title="ภาพรวม" description="ตรวจสอบสุขภาพ Pipeline การดึงและจำแนกข้อมูล TOR">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE_METRICS.map(({ label, value, sub, icon: Icon, tone }) => (
            <div key={label} className="rounded-xl border border-border bg-white p-5">
              <div
                className={`mb-3 grid size-9 place-items-center rounded-lg ${
                  tone === "success" ? "bg-success-soft" : "bg-surface-alt"
                }`}
              >
                <Icon size={18} className={tone === "success" ? "text-success" : "text-ink"} />
              </div>
              <p className="text-xs text-ink-muted">{label}</p>
              <p
                className={`mt-1 text-xl font-bold ${
                  tone === "success" ? "text-success" : "text-ink"
                }`}
              >
                {value}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>
            </div>
          ))}
        </div>

        {/* Scrape history */}
        <div className="rounded-xl border border-border bg-white p-6">
          <h2 className="mb-4 text-base font-bold text-ink">ประวัติการดึงข้อมูล (7 วันล่าสุด)</h2>
          <div className="space-y-2">
            {SCRAPE_HISTORY.map((row) => (
              <div
                key={row.date}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm"
              >
                <span className="text-ink-muted">{row.date}</span>
                <span className="font-medium text-ink">
                  {row.newCount > 0 ? `+${row.newCount} รายการใหม่` : "ไม่มีรายการใหม่"}
                </span>
                <span
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                    row.status === "สำเร็จ"
                      ? "bg-success-soft text-success"
                      : "bg-danger-soft text-danger"
                  }`}
                >
                  {row.status === "สำเร็จ" ? <Check size={12} /> : <AlertTriangle size={12} />}
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Classification */}
        <div className="rounded-xl border border-border bg-white p-6">
          <h2 className="mb-4 text-base font-bold text-ink">ผลการจำแนกประเภท (Vertex AI)</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {CLASSIFICATION_STATS.map(({ label, count, pct }) => (
              <div key={label} className="rounded-lg border border-border p-4">
                <p className="text-xs text-ink-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{count}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-muted">{pct}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}
