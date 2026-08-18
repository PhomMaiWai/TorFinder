import Link from "next/link";

import type { Opportunity } from "@/types/opportunity";

type DashboardSidebarProps = {
  savedCount: number;
  byDeadline: Opportunity[];
};

export function DashboardSidebar({ savedCount, byDeadline }: DashboardSidebarProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-[calc(theme(spacing.14)+1px)]">
      {/* Upcoming deadlines */}
      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <p className="text-sm font-semibold text-ink">กำหนดส่งใกล้ถึง</p>
        </div>
        <div className="divide-y divide-border">
          {byDeadline.map((opp) => (
            <Link
              key={opp.id}
              href={`/tor/${opp.id}`}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-alt"
            >
              <span
                className={`size-2 shrink-0 rounded-full ${
                  opp.daysLeft <= 7 ? "bg-danger" : "bg-border"
                }`}
              />
              <p className="min-w-0 flex-1 truncate text-sm text-ink">
                {opp.title}
              </p>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                  opp.daysLeft <= 7
                    ? "bg-danger-soft text-danger"
                    : "bg-surface-alt text-ink-muted"
                }`}
              >
                {opp.daysLeft}ว
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Company profile */}
      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">โปรไฟล์บริษัท</p>
          <span className="text-sm font-bold text-accent">80%</span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
          <div className="h-full w-4/5 rounded-full bg-accent transition-all" />
        </div>

        <div className="mt-4 space-y-2">
          {[
            { label: "ชื่อบริษัท", done: true },
            { label: "ความเชี่ยวชาญ", done: true },
            { label: "Tech Stack", done: false },
            { label: "ขนาดบริษัท", done: true },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span
                className={`size-4 shrink-0 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                  done
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-white text-transparent"
                }`}
              >
                ✓
              </span>
              <span className={done ? "text-ink-muted" : "font-medium text-ink"}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <button className="mt-4 w-full rounded-lg border border-border py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink">
          เพิ่ม Tech Stack
        </button>
      </div>

      {/* Quick links */}
      <div className="rounded-xl border border-border bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-ink">บันทึกไว้</p>
        {savedCount === 0 ? (
          <p className="text-sm text-ink-muted">ยังไม่มีรายการที่บันทึก</p>
        ) : (
          <p className="text-sm text-ink-muted">
            มี{" "}
            <span className="font-semibold text-ink">{savedCount} รายการ</span>{" "}
            ที่กำลังพิจารณาอยู่
          </p>
        )}
      </div>
    </aside>
  );
}
