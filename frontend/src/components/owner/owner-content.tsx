"use client";

import { FileText, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

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
import { hideTor, unhideTor } from "@/app/owner/actions";
import { isKnown } from "@/lib/tor-ui";
import type { MatchedCompany, TorFeedback, TorRecord } from "@/types/tor";

type TabKey = "companies" | "feedback";

/** What one expanded row shows, loaded the first time it is opened. */
type Panel = { companies: MatchedCompany[]; feedback: TorFeedback[] };

function getStagePills(t: (key: string) => string) {
  return [
    { id: "ทั้งหมด", label: t("stagePillAll") },
    { id: "เปิดรับฟังความคิดเห็น", label: t("stagePillFeedback") },
    { id: "ประกาศ TOR", label: t("stagePillPublished") },
  ];
}

/**
 * Fetches a row's companies and comments once, when it is first opened.
 * Announcements are counted in the hundreds; loading every panel up front would
 * be hundreds of requests for panels nobody expands.
 */
function usePanel(torId: string | null) {
  const [panels, setPanels] = useState<Record<string, Panel>>({});

  useEffect(() => {
    if (!torId || panels[torId]) return;

    let cancelled = false;
    fetch(`/api/tor/${torId}/panel`)
      .then((res) => (res.ok ? res.json() : { companies: [], feedback: [] }))
      .then((panel: Panel) => {
        if (!cancelled) setPanels((current) => ({ ...current, [torId]: panel }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [torId, panels]);

  return panels;
}

export function OwnerContent({
  tors,
  deletedTors,
  feedbackCounts,
}: {
  tors: TorRecord[];
  /** Hidden announcements, for the restore list. Empty unless the caller is an admin. */
  deletedTors: TorRecord[];
  /** Approved comments per announcement, so a row can show a count unopened. */
  feedbackCounts: Record<string, number>;
}) {
  const t = useTranslations("OwnerPage");
  const STAGE_PILLS = getStagePills(t);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("ทั้งหมด");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tabMap, setTabMap] = useState<Record<string, TabKey>>({});
  // Deleting is one click away from destroying a public notice, so the row asks
  // once before it happens.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const panels = usePanel(expandedId);

  const q = search.trim().toLowerCase();
  const filtered = tors.filter((tor) => {
    const matchSearch = !q || `${tor.title} ${tor.agency}`.toLowerCase().includes(q);
    const matchStage = stage === "ทั้งหมด" || tor.stage === stage;
    return matchSearch && matchStage;
  });

  const totalFeedback = Object.values(feedbackCounts).reduce((sum, count) => sum + count, 0);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    setTabMap((prev) => ({ ...prev, [id]: prev[id] ?? "companies" }));
  }

  return (
    <AppShell>
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription", {
          torCount: tors.length,
          matchedCount: 0,
          pendingCount: totalFeedback,
        })}
        action={<PrimaryButton href="/public">{t("publishNewTor")}</PrimaryButton>}
      />

      <PageBody>
        <Section>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            pills={STAGE_PILLS}
            activePill={stage}
            onPillChange={setStage}
          />

          <p className="mt-3 text-xs text-zinc-400">{t("itemsCount", { count: filtered.length })}</p>

          <div className="mt-3">
            {filtered.length === 0 ? (
              <EmptyState title={t("noItemsFound")} />
            ) : (
              <ItemList>
                {filtered.map((tor) => {
                  const isExpanded = expandedId === tor.id;
                  const panel = panels[tor.id];
                  const currentTab: TabKey = tabMap[tor.id] ?? "companies";
                  const companies = panel?.companies ?? [];
                  const feedback = panel?.feedback ?? [];

                  return (
                    <ItemRow
                      key={tor.id}
                      onClick={() => toggleExpand(tor.id)}
                      isOpen={isExpanded}
                      icon={<FileText size={15} className="text-zinc-400" />}
                      iconBg="bg-zinc-100"
                      title={tor.title}
                      subtitle={t("rowSubtitle", {
                        agency: tor.agency,
                        companiesCount: companies.length,
                        feedbackCount: feedbackCounts[tor.id] ?? 0,
                      })}
                      trailing={
                        <div className="flex items-center gap-3">
                          <StatusBadge label={tor.stage} />
                          <span className="text-xs tabular-nums text-zinc-400">
                            {isKnown(tor.deadline)
                              ? t("daysSuffix", { days: tor.daysLeft })
                              : tor.budget}
                          </span>
                        </div>
                      }
                      actions={
                        <>
                          <Link
                            href={`/tor/${tor.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                          >
                            {t("viewTor")}
                          </Link>
                          {confirmingDeleteId === tor.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                disabled={isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmingDeleteId(null);
                                  if (expandedId === tor.id) setExpandedId(null);
                                  startTransition(() => void hideTor(tor.id));
                                }}
                                className="flex h-8 items-center rounded-lg bg-danger px-2.5 text-xs font-semibold text-white hover:bg-danger/90 disabled:opacity-50"
                              >
                                {t("confirmDelete")}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmingDeleteId(null);
                                }}
                                className="flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                              >
                                {t("cancelDelete")}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmingDeleteId(tor.id);
                              }}
                              className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-zinc-500 hover:bg-danger-soft hover:text-danger"
                            >
                              <Trash2 size={13} />
                              {t("deleteAction")}
                            </button>
                          )}
                        </>
                      }
                      expandedContent={
                        isExpanded ? (
                          <div className="border-t border-zinc-100 bg-zinc-50">
                            <div className="flex gap-4 border-b border-zinc-100 px-4 pl-[4.25rem]">
                              {(
                                [
                                  {
                                    key: "companies",
                                    label: t("companiesTabLabel", { count: companies.length }),
                                  },
                                  {
                                    key: "feedback",
                                    label: t("feedbackTabLabel", { count: feedback.length }),
                                  },
                                ] as const
                              ).map(({ key, label }) => (
                                <button
                                  key={key}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTabMap((prev) => ({ ...prev, [tor.id]: key }));
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
                              {!panel && <p className="text-sm text-zinc-400">{t("loadingPanel")}</p>}

                              {panel &&
                                currentTab === "companies" &&
                                (companies.length === 0 ? (
                                  <p className="text-sm text-zinc-400">{t("noMatchedCompanies")}</p>
                                ) : (
                                  companies.map((company) => (
                                    <div
                                      key={company.companyName}
                                      className="rounded-lg border border-zinc-200 bg-white px-4 py-3"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600">
                                            {company.companyName.charAt(0)}
                                          </span>
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium text-zinc-900">
                                              {company.companyName}
                                            </p>
                                            <p className="text-xs text-zinc-400">
                                              {company.specialty} · {company.size}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="text-sm font-semibold tabular-nums text-zinc-800">
                                          {company.score}%
                                        </span>
                                      </div>
                                      {company.gaps.length > 0 && (
                                        <p className="mt-1.5 text-xs text-warn">{company.gaps[0]}</p>
                                      )}
                                    </div>
                                  ))
                                ))}

                              {panel &&
                                currentTab === "feedback" &&
                                (feedback.length === 0 ? (
                                  <p className="text-sm text-zinc-400">{t("noFeedback")}</p>
                                ) : (
                                  feedback.map((entry) => (
                                    <div
                                      key={entry.id}
                                      className="rounded-lg border border-zinc-200 bg-white p-4"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <p className="text-sm font-medium text-zinc-900">
                                          {entry.author}
                                        </p>
                                        <span className="text-xs text-zinc-400">{entry.status}</span>
                                      </div>
                                      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                                        {entry.text}
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

        {deletedTors.length > 0 && (
          <Section title={t("trashTitle", { count: deletedTors.length })}>
            <ItemList>
              {deletedTors.map((tor) => (
                <ItemRow
                  key={tor.id}
                  icon={<FileText size={15} className="text-zinc-400" />}
                  iconBg="bg-zinc-100"
                  title={tor.title}
                  subtitle={tor.agency}
                  actions={
                    <button
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        startTransition(() => void unhideTor(tor.id));
                      }}
                      className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
                    >
                      <RotateCcw size={13} />
                      {t("restoreAction")}
                    </button>
                  }
                />
              ))}
            </ItemList>
          </Section>
        )}
      </PageBody>
    </AppShell>
  );
}
