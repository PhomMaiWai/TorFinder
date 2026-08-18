"use client";

import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Pencil,
  RefreshCw,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-sidebar";
import { OPPORTUNITIES } from "@/data/opportunities";
import { FEEDBACK_ENTRIES } from "@/data/tor-details";

type AdminTab = "pipeline" | "corrections" | "moderation" | "audit";

const PIPELINE_METRICS = [
  {
    label: "สถานะ Pipeline",
    value: "ปกติ",
    sub: "อัปเดตล่าสุด 2 นาทีที่แล้ว",
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    label: "TOR ใหม่วันนี้",
    value: "23",
    sub: "จาก 47 หน่วยงาน กทม.",
    icon: RefreshCw,
    color: "text-ink",
    bg: "bg-surface-alt",
  },
  {
    label: "จำแนกประเภทแล้ว",
    value: "21 / 23",
    sub: "รอจำแนก 2 รายการ",
    icon: Activity,
    color: "text-ink",
    bg: "bg-surface-alt",
  },
  {
    label: "แจ้งเตือนบริษัท",
    value: "87",
    sub: "ส่งสำเร็จทั้งหมด",
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
  },
];

const CORRECTIONS_QUEUE = [
  {
    id: 1,
    torTitle: "พัฒนาระบบบริหารจัดการศูนย์ข้อมูลเมืองอัจฉริยะ",
    field: "ราคากลาง",
    current: "฿11,800,000",
    suggested: "฿12,500,000",
    reporter: "บริษัท เทค เวิร์คส์",
    date: "12 ส.ค. 2569",
    severity: "ปานกลาง",
  },
  {
    id: 2,
    torTitle: "โครงการระบบสารสนเทศเพื่อบริหารจัดการโรงพยาบาล",
    field: "วันที่กำหนดส่ง",
    current: "28 ส.ค. 2569",
    suggested: "25 ส.ค. 2569",
    reporter: "บริษัท เฮลท์ ซิส จำกัด",
    date: "11 ส.ค. 2569",
    severity: "สูง",
  },
  {
    id: 3,
    torTitle: "พัฒนาแอปพลิเคชันบริการประชาชนสำหรับงานเขต",
    field: "คุณสมบัติผู้เสนอ",
    current: "ประสบการณ์ 2 ปี",
    suggested: "ประสบการณ์ 1 ปี",
    reporter: "ประชาชนทั่วไป",
    date: "10 ส.ค. 2569",
    severity: "ต่ำ",
  },
];

const AUDIT_LOG = [
  {
    id: 1,
    action: "จำแนก TOR",
    detail: "พัฒนาระบบบริหารจัดการศูนย์ข้อมูล → ซอฟต์แวร์",
    actor: "Vertex AI",
    date: "12 ส.ค. 2569 13:45",
    type: "auto",
  },
  {
    id: 2,
    action: "อนุมัติความคิดเห็น",
    detail: "บริษัท เทค เวิร์คส์ — TOR #1",
    actor: "admin@bma.go.th",
    date: "12 ส.ค. 2569 11:20",
    type: "manual",
  },
  {
    id: 3,
    action: "แก้ไข TOR",
    detail: "TOR #2 — แก้ไขขอบเขตงาน (manual correction)",
    actor: "admin@bma.go.th",
    date: "11 ส.ค. 2569 16:05",
    type: "manual",
  },
  {
    id: 4,
    action: "Scrape สำเร็จ",
    detail: "ดึงข้อมูลจาก e-GP 23 รายการ",
    actor: "Scraper Bot",
    date: "11 ส.ค. 2569 08:00",
    type: "auto",
  },
  {
    id: 5,
    action: "ปฏิเสธความคิดเห็น",
    detail: "Spam — TOR #3",
    actor: "admin@bma.go.th",
    date: "10 ส.ค. 2569 14:30",
    type: "manual",
  },
];

const TAB_ITEMS: { key: AdminTab; label: string; icon: React.ElementType }[] =
  [
    { key: "pipeline", label: "Pipeline", icon: Activity },
    { key: "corrections", label: "แก้ไข TOR", icon: Pencil },
    { key: "moderation", label: "กลั่นกรองความคิดเห็น", icon: MessageSquare },
    { key: "audit", label: "Audit Log", icon: ClipboardList },
  ];

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("pipeline");
  const [corrections, setCorrections] = useState(CORRECTIONS_QUEUE);
  const [feedbackItems, setFeedbackItems] = useState(FEEDBACK_ENTRIES);

  function approveCorrection(id: number) {
    setCorrections((prev) => prev.filter((c) => c.id !== id));
  }

  function rejectCorrection(id: number) {
    setCorrections((prev) => prev.filter((c) => c.id !== id));
  }

  function updateFeedbackStatus(
    id: number,
    status: "อนุมัติ" | "ปฏิเสธ",
  ) {
    setFeedbackItems((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f)),
    );
  }

  const pendingFeedback = feedbackItems.filter(
    (f) => f.status === "รอตรวจสอบ",
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                แผงควบคุม
              </h1>
              <span className="flex items-center gap-1 rounded-md bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                <ShieldAlert size={12} />
                Admin
              </span>
            </div>
            <p className="text-sm text-ink-muted">
              ตรวจสอบสุขภาพ Pipeline, แก้ไข TOR, และกลั่นกรองเนื้อหา
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
          {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-b-2 border-accent text-accent"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon size={15} />
              {label}
              {key === "moderation" && pendingFeedback.length > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-danger text-xs font-bold text-white">
                  {pendingFeedback.length}
                </span>
              )}
              {key === "corrections" && corrections.length > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                  {corrections.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Pipeline */}
        {tab === "pipeline" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE_METRICS.map(
                ({ label, value, sub, icon: Icon, color, bg }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border bg-white p-5"
                  >
                    <div
                      className={`mb-3 grid size-9 place-items-center rounded-lg ${bg}`}
                    >
                      <Icon size={18} className={color} />
                    </div>
                    <p className="text-xs text-ink-muted">{label}</p>
                    <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>
                  </div>
                ),
              )}
            </div>

            {/* Scrape history */}
            <div className="rounded-xl border border-border bg-white p-6">
              <h2 className="mb-4 text-base font-bold text-ink">
                ประวัติการดึงข้อมูล (7 วันล่าสุด)
              </h2>
              <div className="space-y-2">
                {[
                  { date: "12 ส.ค. 2569 08:00", new: 23, status: "สำเร็จ" },
                  { date: "11 ส.ค. 2569 08:00", new: 18, status: "สำเร็จ" },
                  { date: "10 ส.ค. 2569 08:00", new: 31, status: "สำเร็จ" },
                  { date: "9 ส.ค. 2569 08:00", new: 0, status: "ล้มเหลว" },
                  { date: "8 ส.ค. 2569 08:00", new: 14, status: "สำเร็จ" },
                ].map((row) => (
                  <div
                    key={row.date}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm"
                  >
                    <span className="text-ink-muted">{row.date}</span>
                    <span className="font-medium text-ink">
                      {row.new > 0 ? `+${row.new} รายการใหม่` : "ไม่มีรายการใหม่"}
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                        row.status === "สำเร็จ"
                          ? "bg-green-50 text-green-700"
                          : "bg-danger-soft text-danger"
                      }`}
                    >
                      {row.status === "สำเร็จ" ? (
                        <Check size={12} />
                      ) : (
                        <AlertTriangle size={12} />
                      )}
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Classification */}
            <div className="rounded-xl border border-border bg-white p-6">
              <h2 className="mb-4 text-base font-bold text-ink">
                ผลการจำแนกประเภท (Vertex AI)
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "ซอฟต์แวร์", count: 21, pct: 91 },
                  { label: "ไม่ใช่ซอฟต์แวร์", count: 2, pct: 9 },
                  { label: "รอจำแนก", count: 0, pct: 0 },
                ].map(({ label, count, pct }) => (
                  <div
                    key={label}
                    className="rounded-lg border border-border p-4"
                  >
                    <p className="text-xs text-ink-muted">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-ink">{count}</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{pct}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: TOR Corrections */}
        {tab === "corrections" && (
          <div className="space-y-3">
            {corrections.length === 0 ? (
              <div className="py-20 text-center">
                <CheckCircle2
                  size={36}
                  className="mx-auto mb-3 text-green-500 opacity-70"
                />
                <p className="text-base font-semibold text-ink">
                  ไม่มีรายการรอแก้ไข
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  ทุกรายการได้รับการตรวจสอบแล้ว
                </p>
              </div>
            ) : (
              corrections.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-border bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-4 max-sm:flex-col">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                            c.severity === "สูง"
                              ? "bg-danger-soft text-danger"
                              : c.severity === "ปานกลาง"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-surface-alt text-ink-muted"
                          }`}
                        >
                          {c.severity}
                        </span>
                        <span className="text-xs text-ink-muted">
                          รายงานโดย {c.reporter} · {c.date}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-ink">
                        {c.torTitle}
                      </h3>
                      <p className="mt-2 text-sm text-ink-muted">
                        แก้ไข:{" "}
                        <span className="font-medium text-ink">{c.field}</span>
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-sm">
                        <span className="rounded-md bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger line-through">
                          {c.current}
                        </span>
                        <span className="text-ink-muted">→</span>
                        <span className="rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                          {c.suggested}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => rejectCorrection(c.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                      >
                        <XCircle size={15} />
                        ปฏิเสธ
                      </button>
                      <button
                        onClick={() => approveCorrection(c.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
                      >
                        <Check size={15} />
                        อนุมัติ
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Feedback Moderation */}
        {tab === "moderation" && (
          <div className="space-y-3">
            {feedbackItems.map((f) => {
              const tor = OPPORTUNITIES.find((o) => o.id === f.torId);
              return (
                <div
                  key={f.id}
                  className="rounded-xl border border-border bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-4 max-sm:flex-col">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                            f.status === "อนุมัติ"
                              ? "bg-green-50 text-green-700"
                              : f.status === "ปฏิเสธ"
                                ? "bg-danger-soft text-danger"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {f.status}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {f.author} · {f.submittedAt}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted">
                        TOR:{" "}
                        <span className="font-medium text-ink">
                          {tor?.title ?? `#${f.torId}`}
                        </span>
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                        {f.text}
                      </p>
                    </div>

                    {f.status === "รอตรวจสอบ" && (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() =>
                            updateFeedbackStatus(f.id, "ปฏิเสธ")
                          }
                          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                        >
                          <X size={14} />
                          ปฏิเสธ
                        </button>
                        <button
                          onClick={() =>
                            updateFeedbackStatus(f.id, "อนุมัติ")
                          }
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
        )}

        {/* Tab: Audit Log */}
        {tab === "audit" && (
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
                    <p className="text-sm font-semibold text-ink">
                      {log.action}
                    </p>
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
        )}
      </main>
    </AppShell>
  );
}
