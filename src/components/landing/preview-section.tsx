"use client";

import { ArrowRight, Building2, Clock, MessageSquare, Search } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";

import { OPPORTUNITIES } from "@/data/opportunities";
import { FEEDBACK_ENTRIES } from "@/data/tor-details";

export function PreviewSection() {
  const [search, setSearch] = useState("");
  const [feedbackOpenId, setFeedbackOpenId] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return OPPORTUNITIES.filter((opp) => {
      const matchSearch =
        !q ||
        `${opp.title} ${opp.agency} ${opp.tags.join(" ")}`.toLowerCase().includes(q);
      return matchSearch;
    }).slice(0, 4); // Show top 4
  }, [search]);

  function handleSubmitFeedback() {
    if (!feedbackText.trim()) return;
    setFeedbackOpenId(null);
    setFeedbackText("");
  }

  return (
    <section id="preview" className="bg-zinc-50 py-24 sm:py-32">
      <div className="mx-auto max-w-[1000px] px-6">
        <div className="mb-10 text-center sm:mb-14">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            ค้นหาและตรวจสอบ TOR โปร่งใส
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] text-zinc-500">
            ระบบเปิดให้ประชาชนและบริษัทซอฟต์แวร์เข้ามาค้นหาโครงการของ กทม. ได้อย่างอิสระ 
            ตรวจสอบราคา และสามารถส่งข้อเสนอแนะในช่วงประชาพิจารณ์ (Draft) ได้ทันที
          </p>
        </div>

        {/* Mini Public Search Interface */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm sm:p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <Search size={20} className="shrink-0 text-zinc-400" />
            <input
              className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อโครงการ หรือชื่อหน่วยงาน..."
            />
            <Link
              href="/public"
              className="hidden h-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 sm:flex"
            >
              ค้นหาทั้งหมด
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((tor) => {
            const isFeedbackStage = tor.stage === "เปิดรับฟังความคิดเห็น";
            const isUrgent = tor.daysLeft <= 7;
            const approvedCount = FEEDBACK_ENTRIES.filter(
              (f) => f.torId === tor.id && f.status === "อนุมัติ",
            ).length;
            const isFeedbackOpen = feedbackOpenId === tor.id;

            return (
              <article
                key={tor.id}
                className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-[0_4px_20px_rgb(24,24,27/5%)]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
                        isFeedbackStage
                          ? "bg-amber-50 text-amber-700"
                          : "bg-accent-soft text-accent"
                      }`}
                    >
                      {tor.stage}
                    </span>
                    {isUrgent && (
                      <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                        <div className="size-1.5 animate-pulse rounded-full bg-red-500" />
                        ใกล้หมดเขต
                      </span>
                    )}
                  </div>

                  <Link href={`/tor/${tor.id}`} className="mt-3 block group-hover:cursor-pointer">
                    <h3 className="text-[17px] font-semibold leading-tight text-zinc-900 transition-colors group-hover:text-accent">
                      {tor.title}
                    </h3>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <Building2 size={15} className="text-zinc-400" />
                        {tor.agency}
                      </span>
                      <span className="font-medium text-zinc-700">{tor.budget}</span>
                      <span
                        className={`flex items-center gap-1.5 ${
                          isUrgent ? "font-medium text-red-600" : ""
                        }`}
                      >
                        <Clock size={15} className={isUrgent ? "text-red-500" : "text-zinc-400"} />
                        เหลือ {tor.daysLeft} วัน
                      </span>
                    </div>

                    <p className="mt-3.5 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                      {tor.summary}
                    </p>
                  </Link>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 pt-5">
                  <div className="flex items-center gap-2">
                    {approvedCount > 0 && (
                      <span className="mr-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                        <MessageSquare size={13} className="text-zinc-400" />
                        {approvedCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isFeedbackStage && (
                      <button
                        onClick={() => {
                          if (isFeedbackOpen) {
                            setFeedbackOpenId(null);
                          } else {
                            setFeedbackOpenId(tor.id);
                            setFeedbackText("");
                          }
                        }}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-zinc-100 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
                      >
                        {isFeedbackOpen ? "ปิด" : "แสดงความเห็น"}
                      </button>
                    )}
                    <Link
                      href={`/tor/${tor.id}`}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                    >
                      ดูรายละเอียด
                    </Link>
                  </div>
                </div>

                {isFeedbackOpen && (
                  <div className="mt-4 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200/60">
                    <textarea
                      className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-accent/20"
                      rows={2}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="ระบุข้อเสนอแนะ ข้อกังวล หรือความคิดเห็นเพื่อให้โปร่งใสมากขึ้น..."
                    />
                    <div className="mt-2.5 flex justify-end gap-2">
                      <button
                        onClick={() => setFeedbackOpenId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={handleSubmitFeedback}
                        className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-dark"
                      >
                        ส่งความเห็น
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-white py-16 text-center">
            <p className="text-[15px] font-medium text-zinc-700">ไม่พบโครงการที่ตรงกับคำค้นหา</p>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/public"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-6 text-[15px] font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-900"
          >
            ไปหน้า Public Portal ค้นหาโครงการทั้งหมด
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
