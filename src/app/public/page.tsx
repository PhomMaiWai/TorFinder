"use client";

import { Building2, Clock, MessageSquare, Search, SlidersHorizontal, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { OPPORTUNITIES } from "@/data/opportunities";
import { FEEDBACK_ENTRIES } from "@/data/tor-details";

const STAGES = ["เปิดรับฟังความคิดเห็น", "ประกาศ TOR", "ประกาศผู้ชนะ"];
const AGENCIES = Array.from(new Set(OPPORTUNITIES.map((o) => o.agency))).sort();
const TAGS = Array.from(new Set(OPPORTUNITIES.flatMap((o) => o.tags))).sort();

function CheckboxFilter({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  return (
    <div className="mb-7">
      <h3 className="mb-3 text-sm font-bold text-zinc-900">{title}</h3>
      <div className="space-y-2.5">
        {options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-start gap-3">
            <div className="relative mt-0.5 flex items-center">
              <input
                type="checkbox"
                className="peer size-4 cursor-pointer appearance-none rounded border border-zinc-300 bg-white transition-all checked:border-accent checked:bg-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                checked={selected.includes(opt)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selected, opt]);
                  else onChange(selected.filter((x) => x !== opt));
                }}
              />
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </div>
            </div>
            <span className="text-[13px] leading-snug text-zinc-600">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function PublicTorCard({
  tor,
  isFeedbackOpen,
  feedbackText,
  onFeedbackChange,
  onToggleFeedback,
  onSubmitFeedback,
}: {
  tor: typeof OPPORTUNITIES[0];
  isFeedbackOpen: boolean;
  feedbackText: string;
  onFeedbackChange: (val: string) => void;
  onToggleFeedback: () => void;
  onSubmitFeedback: () => void;
}) {
  const isFeedbackStage = tor.stage === "เปิดรับฟังความคิดเห็น";
  const isUrgent = tor.daysLeft <= 7;
  const approvedCount = FEEDBACK_ENTRIES.filter(
    (f) => f.torId === tor.id && f.status === "อนุมัติ",
  ).length;

  return (
    <article className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all duration-200 hover:border-zinc-300 hover:shadow-[0_8px_30px_rgb(24,24,27/6%)]">
      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
                tor.stage === "ประกาศผู้ชนะ" ? "bg-purple-50 text-purple-700" :
                isFeedbackStage ? "bg-amber-50 text-amber-700" : "bg-accent-soft text-accent"
              }`}
            >
              {tor.stage}
            </span>
            {tor.budgetStatus === "สูงกว่าปกติ" && (
              <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 border border-red-100">
                <TrendingUp size={12} />
                งบสูงผิดปกติ
              </span>
            )}
            {tor.budgetStatus === "ต่ำกว่าปกติ" && (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 border border-amber-100">
                <TrendingDown size={12} />
                งบต่ำผิดปกติ
              </span>
            )}
            {tor.budgetStatus === "ปกติ" && (
              <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700 border border-green-100">
                <CheckCircle2 size={12} />
                งบปกติ
              </span>
            )}
            {tor.hasVendorMismatch && (
              <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 border border-red-100">
                <AlertTriangle size={12} />
                ผู้ชนะไม่ตรงสเปก
              </span>
            )}
            {tor.isNew && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                ใหม่
              </span>
            )}
            {isUrgent && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                <div className="size-1.5 animate-pulse rounded-full bg-red-500" />
                ใกล้หมดเขต
              </span>
            )}
          </div>

          <Link href={`/tor/${tor.id}`} className="block">
            <h3 className="text-[17px] font-bold text-zinc-900 transition-colors group-hover:text-accent sm:text-lg">
              {tor.title}
            </h3>
          </Link>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Building2 size={15} className="text-zinc-400" />
              {tor.agency}
            </span>
            <span className={`flex items-center gap-1.5 ${isUrgent ? "font-medium text-red-600" : ""}`}>
              <Clock size={15} className={isUrgent ? "text-red-500" : "text-zinc-400"} />
              เหลือ {tor.daysLeft} วัน
            </span>
          </div>

          <p className="mt-3.5 line-clamp-2 text-sm leading-relaxed text-zinc-600">
            {tor.summary}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {tor.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-500 ring-1 ring-zinc-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start justify-between border-t border-zinc-100 pt-5 sm:w-[220px] sm:items-end sm:border-none sm:pl-6 sm:pt-0">
          <div className="mb-4 w-full sm:mb-0 sm:text-right">
            <div className="mb-1 text-xs font-medium text-zinc-500">งบประมาณโครงการ</div>
            <div className="text-[17px] font-bold text-zinc-900">{tor.budget}</div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:mt-auto">
            {approvedCount > 0 && (
              <div className="mb-1 flex items-center justify-start gap-1.5 text-xs font-medium text-zinc-500 sm:justify-end">
                <MessageSquare size={13} className="text-zinc-400" />
                มี {approvedCount} ความคิดเห็น
              </div>
            )}

            {isFeedbackStage && (
              <button
                onClick={onToggleFeedback}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
              >
                <MessageSquare size={14} />
                {isFeedbackOpen ? "ปิดกล่องข้อความ" : "แสดงความคิดเห็น"}
              </button>
            )}
            <Link
              href={`/tor/${tor.id}`}
              className="flex w-full items-center justify-center rounded-lg bg-zinc-900 py-2 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800"
            >
              ดูรายละเอียด
            </Link>
          </div>
        </div>
      </div>

      {isFeedbackOpen && (
        <div className="border-t border-zinc-100 bg-zinc-50/50 p-5 sm:p-6">
          <label className="mb-2 block text-sm font-semibold text-zinc-900">
            ร่วมแสดงความคิดเห็น (Draft TOR)
          </label>
          <textarea
            className="w-full rounded-xl border border-zinc-200 bg-white p-3.5 text-sm text-zinc-800 shadow-sm outline-none placeholder:text-zinc-400 focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
            rows={3}
            value={feedbackText}
            onChange={(e) => onFeedbackChange(e.target.value)}
            placeholder="ระบุข้อเสนอแนะ ข้อกังวล หรือความคิดเห็น เพื่อให้โครงการเกิดความโปร่งใสและเป็นธรรมที่สุด..."
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-zinc-500">
              * ความคิดเห็นของคุณจะถูกตรวจสอบก่อนแสดงผลต่อสาธารณะ
            </p>
            <div className="flex gap-2">
              <button
                onClick={onToggleFeedback}
                className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              >
                ยกเลิก
              </button>
              <button
                onClick={onSubmitFeedback}
                className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent-dark"
              >
                ส่งความเห็น
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function PublicPage() {
  const [search, setSearch] = useState("");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackOpenId, setFeedbackOpenId] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return OPPORTUNITIES.filter((opp) => {
      const matchSearch =
        !q || `${opp.title} ${opp.agency} ${opp.tags.join(" ")}`.toLowerCase().includes(q);
      const matchStage = selectedStages.length === 0 || selectedStages.includes(opp.stage);
      const matchAgency = selectedAgencies.length === 0 || selectedAgencies.includes(opp.agency);
      const matchTags = selectedTags.length === 0 || opp.tags.some((t) => selectedTags.includes(t));

      return matchSearch && matchStage && matchAgency && matchTags;
    });
  }, [search, selectedStages, selectedAgencies, selectedTags]);

  function handleSubmitFeedback() {
    if (!feedbackText.trim()) return;
    setFeedbackOpenId(null);
    setFeedbackText("");
  }

  function clearAllFilters() {
    setSelectedStages([]);
    setSelectedAgencies([]);
    setSelectedTags([]);
    setSearch("");
  }

  const hasActiveFilters =
    selectedStages.length > 0 || selectedAgencies.length > 0 || selectedTags.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <SiteNavbar />
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              ค้นหาประกาศ TOR ซอฟต์แวร์
            </h1>
            <p className="mt-2 text-[15px] text-zinc-500">
              ค้นหาและติดตามโครงการจัดซื้อจัดจ้างด้านซอฟต์แวร์ของ กทม.
              พร้อมร่วมแสดงความคิดเห็นในระยะร่าง TOR
            </p>
          </div>

          <div className="flex flex-col items-start gap-8 lg:flex-row">
            {/* Mobile Filter Toggle */}
            <div className="flex w-full items-center justify-between lg:hidden">
              <span className="text-sm font-semibold text-zinc-800">
                พบ {filtered.length} รายการ
              </span>
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm"
              >
                <SlidersHorizontal size={16} />
                ตัวกรอง
              </button>
            </div>

            {/* Sidebar Filters */}
            <aside
              className={`w-full shrink-0 lg:block lg:w-[280px] xl:w-[320px] ${
                showMobileFilters ? "block" : "hidden"
              }`}
            >
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-8">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
                    <SlidersHorizontal size={18} /> ตัวกรอง
                  </h2>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-[13px] font-medium text-accent hover:text-accent-dark"
                    >
                      ล้างทั้งหมด
                    </button>
                  )}
                </div>

                {/* Search Box inside sidebar for a tighter layout */}
                <div className="mb-7">
                  <label className="mb-3 block text-sm font-bold text-zinc-900">ค้นหา</label>
                  <div className="relative">
                    <Search
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
                      size={16}
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="คำค้นหา, เลขที่โครงการ..."
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-[13px] text-zinc-900 outline-none transition-colors focus:border-accent/40 focus:bg-white focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                </div>

                <div className="h-px w-full bg-zinc-100 mb-7" />

                <CheckboxFilter
                  title="สถานะโครงการ"
                  options={STAGES}
                  selected={selectedStages}
                  onChange={setSelectedStages}
                />
                
                <div className="h-px w-full bg-zinc-100 mb-7" />

                <CheckboxFilter
                  title="หน่วยงาน (กทม.)"
                  options={AGENCIES}
                  selected={selectedAgencies}
                  onChange={setSelectedAgencies}
                />

                <div className="h-px w-full bg-zinc-100 mb-7" />

                <CheckboxFilter
                  title="หมวดหมู่ / เทคโนโลยี"
                  options={TAGS}
                  selected={selectedTags}
                  onChange={setSelectedTags}
                />
              </div>
            </aside>

            {/* Results Area */}
            <div className="flex-1 min-w-0">
              <div className="mb-5 hidden items-center justify-between lg:flex">
                <h2 className="text-[15px] font-semibold text-zinc-800">
                  พบ <span className="text-zinc-950">{filtered.length}</span> รายการ
                </h2>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-transparent py-24 text-center">
                  <Search size={32} className="mx-auto mb-4 text-zinc-300" />
                  <h3 className="text-base font-semibold text-zinc-900">ไม่พบโครงการที่ค้นหา</h3>
                  <p className="mt-1 text-[15px] text-zinc-500">
                    ลองปรับเปลี่ยนคำค้นหา หรือเอาตัวกรองออก
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="mt-4 rounded-lg bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
                    >
                      ล้างตัวกรองทั้งหมด
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filtered.map((tor) => (
                    <PublicTorCard
                      key={tor.id}
                      tor={tor}
                      isFeedbackOpen={feedbackOpenId === tor.id}
                      feedbackText={feedbackText}
                      onFeedbackChange={setFeedbackText}
                      onToggleFeedback={() => {
                        if (feedbackOpenId === tor.id) {
                          setFeedbackOpenId(null);
                        } else {
                          setFeedbackOpenId(tor.id);
                          setFeedbackText("");
                        }
                      }}
                      onSubmitFeedback={handleSubmitFeedback}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
