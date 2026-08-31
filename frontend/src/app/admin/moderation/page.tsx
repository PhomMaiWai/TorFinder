"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

import { AdminPageShell } from "@/components/layout/admin-page";
import { OPPORTUNITIES } from "@/data/opportunities";
import { FEEDBACK_ENTRIES } from "@/data/tor-details";

export default function AdminModerationPage() {
  const [feedbackItems, setFeedbackItems] = useState(FEEDBACK_ENTRIES);

  function updateFeedbackStatus(id: number, status: "อนุมัติ" | "ปฏิเสธ") {
    setFeedbackItems((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f)),
    );
  }

  return (
    <AdminPageShell
      title="กลั่นกรองความคิดเห็น"
      description="ตรวจสอบและอนุมัติความคิดเห็นสาธารณะที่ส่งเข้ามาต่อ TOR แต่ละรายการ"
    >
      <div className="space-y-3">
        {feedbackItems.map((f) => {
          const tor = OPPORTUNITIES.find((o) => o.id === f.torId);
          return (
            <div key={f.id} className="rounded-xl border border-border bg-white p-5">
              <div className="flex items-start justify-between gap-4 max-sm:flex-col">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                        f.status === "อนุมัติ"
                          ? "bg-success-soft text-success"
                          : f.status === "ปฏิเสธ"
                            ? "bg-danger-soft text-danger"
                            : "bg-warn-soft text-warn"
                      }`}
                    >
                      {f.status}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {f.author} · {f.submittedAt}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    TOR: <span className="font-medium text-ink">{tor?.title ?? `#${f.torId}`}</span>
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.text}</p>
                </div>

                {f.status === "รอตรวจสอบ" && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => updateFeedbackStatus(f.id, "ปฏิเสธ")}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                    >
                      <X size={14} />
                      ปฏิเสธ
                    </button>
                    <button
                      onClick={() => updateFeedbackStatus(f.id, "อนุมัติ")}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
                    >
                      <Check size={14} />
                      อนุมัติ
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AdminPageShell>
  );
}
