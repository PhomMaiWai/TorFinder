"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  EmptyState,
  FilterBar,
  ItemList,
  ItemRow,
  PageBody,
  PageHeader,
  PrimaryButton,
  Section,
  StatusBadge,
} from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import { OPPORTUNITIES } from "@/data/opportunities";
import { FEEDBACK_ENTRIES, MATCHED_COMPANIES } from "@/data/tor-details";

type TabKey = "companies" | "feedback";

const STAGE_PILLS = [
  { id: "ทั้งหมด", label: "ทั้งหมด" },
  { id: "เปิดรับฟังความคิดเห็น", label: "รับความคิดเห็น" },
  { id: "ประกาศ TOR", label: "ประกาศ TOR" },
];

export default function OwnerPage() {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("ทั้งหมด");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [tabMap, setTabMap] = useState<Record<number, TabKey>>({});

  const totalMatched = Object.values(MATCHED_COMPANIES).reduce((s, c) => s + c.length, 0);
  const pendingFeedback = FEEDBACK_ENTRIES.filter((f) => f.status === "รอตรวจสอบ");

  const q = search.trim().toLowerCase();
  const filtered = OPPORTUNITIES.filter((opp) => {
    const matchSearch = !q || `${opp.title} ${opp.agency}`.toLowerCase().includes(q);
    const matchStage = stage === "ทั้งหมด" || opp.stage === stage;
    return matchSearch && matchStage;
  });

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
    setTabMap((prev) => ({ ...prev, [id]: prev[id] ?? "companies" }));
  }

  function setTab(id: number, tab: TabKey) {
    setTabMap((prev) => ({ ...prev, [id]: tab }));
  }

  return (
    <AppShell>
      <PageHeader
        title="โครงการของฉัน"
        description={`${OPPORTUNITIES.length} TOR · ${totalMatched} บริษัทจับคู่ · ${pendingFeedback.length} รอตรวจสอบ`}
        action={<PrimaryButton href="/public">เผยแพร่ TOR ใหม่</PrimaryButton>}
      />

      <PageBody>
        {pendingFeedback.length > 0 && (
          <Section title="รอตรวจสอบ">
            <ItemList>
              {pendingFeedback.map((f) => {
                const tor = OPPORTUNITIES.find((o) => o.id === f.torId);
                return (
                  <div key={f.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{f.author}</p>
                        {tor && (
                          <p className="mt-0.5 text-xs text-zinc-400">{tor.title}</p>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">{f.submittedAt}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-500">{f.text}</p>
                    <div className="mt-3 flex gap-2">
                      <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark">
                        อนุมัติ
                      </button>
                      <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                );
              })}
            </ItemList>
          </Section>
        )}

        <Section title="รายการ TOR">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="ค้นหาโครงการ..."
            pills={STAGE_PILLS}
            activePill={stage}
            onPillChange={setStage}
          />

          <p className="mt-3 text-xs text-zinc-400">{filtered.length} รายการ</p>

          <div className="mt-3">
            {filtered.length === 0 ? (
              <EmptyState title="ไม่พบรายการ" />
            ) : (
              <ItemList>
                {filtered.map((opp) => {
                  const companies = MATCHED_COMPANIES[opp.id] ?? [];
                  const feedback = FEEDBACK_ENTRIES.filter((f) => f.torId === opp.id);
                  const isExpanded = expandedId === opp.id;
                  const currentTab: TabKey = tabMap[opp.id] ?? "companies";

                  return (
                    <ItemRow
                      key={opp.id}
                      onClick={() => toggleExpand(opp.id)}
                      isOpen={isExpanded}
                      icon={<FileText size={15} className="text-zinc-400" />}
                      iconBg="bg-zinc-100"
                      title={opp.title}
                      subtitle={`${opp.agency} · ${companies.length} บริษัท · ${feedback.length} ความคิดเห็น`}
                      trailing={
                        <div className="flex items-center gap-3">
                          <StatusBadge label={opp.stage} />
                          <span className="text-xs tabular-nums text-zinc-400">
                            {opp.daysLeft} วัน
                          </span>
                        </div>
                      }
                      actions={
                        <Link
                          href={`/tor/${opp.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                        >
                          ดู TOR
                        </Link>
                      }
                      expandedContent={
                        isExpanded ? (
                          <div className="border-t border-zinc-100 bg-zinc-50">
                            <div className="flex gap-4 border-b border-zinc-100 px-4 pl-[4.25rem]">
                              {(
                                [
                                  { key: "companies", label: `บริษัท (${companies.length})` },
                                  { key: "feedback", label: `ความคิดเห็น (${feedback.length})` },
                                ] as const
                              ).map(({ key, label }) => (
                                <button
                                  key={key}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTab(opp.id, key);
                                  }}
                                  className={`relative h-9 text-sm font-medium ${
                                    currentTab === key
                                      ? "text-zinc-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-zinc-900"
                                      : "text-zinc-400 hover:text-zinc-700"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>

                            <div className="space-y-2 p-4 pl-[4.25rem]">
                              {currentTab === "companies" &&
                                (companies.length === 0 ? (
                                  <p className="text-sm text-zinc-400">ยังไม่มีบริษัทที่จับคู่</p>
                                ) : (
                                  companies.map((c) => (
                                    <div
                                      key={c.name}
                                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600">
                                          {c.name.charAt(0)}
                                        </span>
                                        <div>
                                          <p className="text-sm font-medium text-zinc-900">{c.name}</p>
                                          <p className="text-xs text-zinc-400">
                                            {c.specialty} · {c.size}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="text-sm font-semibold tabular-nums text-zinc-800">
                                        {c.score}%
                                      </span>
                                    </div>
                                  ))
                                ))}

                              {currentTab === "feedback" &&
                                (feedback.length === 0 ? (
                                  <p className="text-sm text-zinc-400">ยังไม่มีความคิดเห็น</p>
                                ) : (
                                  feedback.map((f) => (
                                    <div
                                      key={f.id}
                                      className="rounded-lg border border-zinc-200 bg-white p-4"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <p className="text-sm font-medium text-zinc-900">{f.author}</p>
                                        <span className="text-xs text-zinc-400">{f.status}</span>
                                      </div>
                                      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                                        {f.text}
                                      </p>
                                    </div>
                                  ))
                                ))}
                            </div>
                          </div>
                        ) : undefined
                      }
                    />
                  );
                })}
              </ItemList>
            )}
          </div>
        </Section>
      </PageBody>
    </AppShell>
  );
}
