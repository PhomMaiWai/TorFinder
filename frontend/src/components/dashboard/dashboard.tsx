"use client";

import {
  Bookmark,
  Building2,
  Check,
  Clock,
  ExternalLink,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-sidebar";
import { OPPORTUNITY_FILTERS } from "@/data/opportunities";
import type { Opportunity, OpportunityFilter } from "@/types/opportunity";

type DashboardProps = { opportunities: Opportunity[] };

const DEFAULT_FILTER: OpportunityFilter = "ทั้งหมด";
const INITIAL_SAVED = [3];

/* ── Opportunity item only ───────────────────────── */

function OpportunityCard({
  opportunity,
  isSaved,
  onSaveToggle,
}: {
  opportunity: Opportunity;
  isSaved: boolean;
  onSaveToggle: (id: number, event: React.MouseEvent) => void;
}) {
  const isUrgent = opportunity.daysLeft <= 7;
  const isHighMatch = opportunity.match >= 90;

  return (
    <article className="group relative rounded-xl border border-zinc-200 bg-white p-5 transition-all duration-200 hover:border-zinc-300 hover:shadow-[0_8px_30px_rgb(24,24,27/6%)]">
      <div className="flex gap-4 sm:gap-5">
        {/* Match Circle */}
        <div className="hidden shrink-0 flex-col items-center sm:flex">
          <div
            className={`relative flex size-14 items-center justify-center rounded-full border-[3px] bg-white ${
              isHighMatch ? "border-accent text-accent" : "border-zinc-200 text-zinc-700"
            }`}
          >
            <span className="text-[17px] font-bold tracking-tight">{opportunity.match}</span>
            <span className="absolute -bottom-2 bg-white px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Match
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* Status & Tags Row */}
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
                  opportunity.stage === "เปิดรับฟังความคิดเห็น"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-accent-soft text-accent"
                }`}
              >
                {opportunity.stage}
              </span>
              {opportunity.isNew && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                  ใหม่
                </span>
              )}
              {isUrgent && (
                <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                  <div className="size-1.5 animate-pulse rounded-full bg-red-500" />
                  ใกล้หมดเขต
                </span>
              )}
            </div>
            
            {/* Mobile Match */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold sm:hidden ${
                isHighMatch ? "bg-accent-soft text-accent" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {opportunity.match}% Match
            </span>
          </div>

          <Link href={`/tor/${opportunity.id}`}>
            <h3 className="text-base font-semibold leading-tight text-zinc-900 transition-colors group-hover:text-accent sm:text-[17px]">
              {opportunity.title}
            </h3>
          </Link>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Building2 size={15} className="text-zinc-400" />
              {opportunity.agency}
            </span>
            <span className="font-medium text-zinc-700">{opportunity.budget}</span>
            <span
              className={`flex items-center gap-1.5 ${
                isUrgent ? "font-medium text-red-600" : ""
              }`}
            >
              <Clock size={15} className={isUrgent ? "text-red-500" : "text-zinc-400"} />
              เหลือ {opportunity.daysLeft} วัน
            </span>
          </div>

          <p className="mt-3.5 line-clamp-2 text-sm leading-relaxed text-zinc-500">
            {opportunity.summary}
          </p>

          {/* Divider */}
          <div className="my-4 h-px w-full bg-zinc-100" />
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {opportunity.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-500 ring-1 ring-zinc-200"
                >
                  {tag}
                </span>
              ))}
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                aria-label={isSaved ? "ยกเลิกบันทึก" : "บันทึก"}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
                  isSaved
                    ? "bg-accent-soft text-accent"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                }`}
                onClick={(event) => onSaveToggle(opportunity.id, event)}
              >
                <Bookmark size={14} fill={isSaved ? "currentColor" : "none"} />
                {isSaved ? "บันทึกแล้ว" : "บันทึก"}
              </button>
              <Link
                href={`/tor/${opportunity.id}`}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800"
              >
                ดูรายละเอียด
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ── Right sidebar panels ────────────────────────── */

function DeadlinePanel({ opportunities }: { opportunities: Opportunity[] }) {
  const byDeadline = [...opportunities]
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-ink">กำหนดส่งใกล้ถึง</p>
      </div>
      <div className="divide-y divide-border">
        {byDeadline.map((opp) => (
          <Link
            key={opp.id}
            href={`/tor/${opp.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-alt"
          >
            <span
              className={`size-2 shrink-0 rounded-full ${
                opp.daysLeft <= 7 ? "bg-accent" : "bg-border"
              }`}
            />
            <p className="min-w-0 flex-1 truncate text-sm text-ink">{opp.title}</p>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                opp.daysLeft <= 7
                  ? "bg-accent-soft text-accent"
                  : "bg-surface-alt text-ink-muted"
              }`}
            >
              {opp.daysLeft}ว
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ProfilePanel() {
  const items = [
    { label: "ชื่อบริษัท", done: true },
    { label: "ความเชี่ยวชาญ", done: true },
    { label: "Tech Stack", done: false },
    { label: "ขนาดบริษัท", done: true },
  ];
  const percent = Math.round(
    (items.filter((item) => item.done).length / items.length) * 100,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-ink">โปรไฟล์บริษัท</p>
        <Link href="/profile" className="text-xs font-medium text-accent hover:text-accent-dark">
          แก้ไข
        </Link>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-ink-muted">ความสมบูรณ์</span>
          <span className="font-bold text-ink">{percent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-4 space-y-2">
          {items.map(({ label, done }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                  done ? "bg-accent text-white" : "border-2 border-border"
                }`}
              >
                {done && <Check size={9} strokeWidth={3} />}
              </span>
              <span className={done ? "text-ink-muted" : "font-medium text-ink"}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <Link
          href="/profile"
          className="mt-4 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border text-xs font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
        >
          ตั้งค่าโปรไฟล์
        </Link>
      </div>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────── */

export function Dashboard({ opportunities }: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<OpportunityFilter>(DEFAULT_FILTER);
  const [savedIds, setSavedIds] = useState<number[]>(INITIAL_SAVED);
  const [toastMessage, setToastMessage] = useState("");

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return opportunities.filter((opportunity) => {
      const text = `${opportunity.title} ${opportunity.agency} ${opportunity.tags.join(
        " ",
      )}`.toLowerCase();
      const matchesSearch = !query || text.includes(query);
      const matchesFilter =
        activeFilter === DEFAULT_FILTER ||
        (activeFilter === "ตรงกับคุณสูง" && opportunity.match >= 90) ||
        opportunity.stage === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, opportunities, searchQuery]);

  const urgentCount = opportunities.filter((opportunity) => opportunity.daysLeft <= 7).length;
  const highMatchCount = opportunities.filter((opportunity) => opportunity.match >= 90).length;

  function handleSaveToggle(id: number, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const wasSaved = savedIds.includes(id);
    setSavedIds((previous) =>
      wasSaved ? previous.filter((savedId) => savedId !== id) : [...previous, id],
    );
    setToastMessage(wasSaved ? "นำออกจากรายการที่บันทึกแล้ว" : "บันทึกโอกาสนี้แล้ว");
    window.setTimeout(() => setToastMessage(""), 2400);
  }

  return (
    <AppShell>
      <main className="flex min-h-screen flex-col bg-zinc-50/50">
        {/* Header - Fixed top, white, minimal like /public */}
        <header className="shrink-0 border-b border-zinc-200 bg-white px-8 py-7">
          <div className="mx-auto w-full max-w-[1400px]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Arun Digital Co., Ltd
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
                  ภาพรวมระบบ
                </h1>
                <p className="mt-1.5 max-w-xl text-sm text-zinc-500">
                  โอกาส TOR ที่ตรงกับโปรไฟล์บริษัท จัดลำดับตามความเหมาะสมและกำหนดส่ง เพื่อให้คุณไม่พลาดโครงการสำคัญของกรุงเทพมหานคร
                </p>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex flex-col items-end">
                  <span className="text-lg font-bold text-zinc-900 leading-none">{opportunities.length}</span>
                  <span className="mt-1 text-[11px] font-medium text-zinc-500">ทั้งหมด</span>
                </div>
                <div className="h-8 w-px bg-zinc-200" />
                <div className="flex flex-col items-end">
                  <span className="text-lg font-bold text-accent leading-none">{highMatchCount}</span>
                  <span className="mt-1 text-[11px] font-medium text-zinc-500">Match สูง</span>
                </div>
                <div className="h-8 w-px bg-zinc-200" />
                <div className="flex flex-col items-end">
                  <span className="text-lg font-bold text-red-500 leading-none">{urgentCount}</span>
                  <span className="mt-1 text-[11px] font-medium text-zinc-500">ใกล้หมดเขต</span>
                </div>
                <div className="h-8 w-px bg-zinc-200" />
                <div className="flex flex-col items-end">
                  <span className="text-lg font-bold text-zinc-900 leading-none">{savedIds.length}</span>
                  <span className="mt-1 text-[11px] font-medium text-zinc-500">บันทึกไว้</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-6">
          {/* Toolbar: Search + Filters (Full Width matching /public) */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-2 pl-4 shadow-sm">
            <div className="flex min-w-[280px] flex-1 items-center gap-3">
              <Search size={18} className="shrink-0 text-zinc-400" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="ค้นหาโครงการ หน่วยงาน หรือเทคโนโลยี..."
              />
            </div>
            
            <div className="hidden h-6 w-px bg-zinc-200 md:block" />
            
            <div className="flex w-full items-center justify-between gap-4 md:w-auto">
              <div className="flex gap-1.5 pr-2">
                {OPPORTUNITY_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                      activeFilter === filter
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            {/* Left Area - List */}
            <section>
              {/* List Header */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-800">โอกาสที่แนะนำ</h2>
                <div className="flex items-center gap-3">
                  <p className="text-[13px] text-zinc-500">
                    พบ <span className="font-semibold text-zinc-900">{filtered.length}</span> รายการ
                  </p>
                  <div className="h-4 w-px bg-zinc-200" />
                  <Link
                    href="/public"
                    className="flex items-center gap-1 text-[13px] font-medium text-accent hover:text-accent-dark"
                  >
                    ดูโอกาสใหม่ <ExternalLink size={13} />
                  </Link>
                </div>
              </div>

              {/* Cards Container */}
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                {filtered.length === 0 ? (
                  <div className="px-5 py-20 text-center">
                    <Search size={28} className="mx-auto mb-3 text-zinc-300" />
                    <p className="text-base font-medium text-zinc-700">ไม่พบรายการที่ตรงกัน</p>
                    <p className="mt-1 text-[13px] text-zinc-500">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {filtered.map((opportunity) => (
                      <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        isSaved={savedIds.includes(opportunity.id)}
                        onSaveToggle={handleSaveToggle}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Right Area - Sidebars */}
            <aside className="space-y-5 xl:sticky xl:top-7 xl:self-start">
              <DeadlinePanel opportunities={opportunities} />
              <ProfilePanel />
            </aside>
          </div>
        </div>
      </main>

      {toastMessage && (
        <div
          className="animate-toast fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white shadow-[0_18px_45px_rgb(24,24,27/20%)]"
          role="status"
        >
          <span className="grid size-6 place-items-center rounded-full bg-white/10 text-white">
            <Check size={13} />
          </span>
          {toastMessage}
        </div>
      )}
    </AppShell>
  );
}
