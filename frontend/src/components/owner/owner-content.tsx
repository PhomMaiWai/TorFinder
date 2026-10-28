"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  EmptyState,
  FilterBar,
  ItemList,
  ItemRow,
  PageBody,
  PageHeader,
  Section,
  StatusBadge,
  SummaryCard,
  SummaryGrid,
} from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import type { OwnTors } from "@/lib/owner-api";
import { isKnown } from "@/lib/tor-ui";

const ALL = "ทั้งหมด";

/**
 * The project owner's page: only the announcements an admin linked to this
 * account, each with how many companies it suits and how many comments it has
 * drawn. Read-only — publishing, hiding and correcting stay with the admins.
 */
export function OwnerContent({ data }: { data: OwnTors }) {
  const t = useTranslations("OwnerPage");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState(ALL);
  const { tors, totals } = data;

  // Only the stages the owner's own records are in — an empty pill is a dead end.
  const pills = [
    { id: ALL, label: t("stagePillAll") },
    ...[...new Set(tors.map((tor) => tor.stage))].map((id) => ({ id, label: id })),
  ];

  const q = search.trim().toLowerCase();
  const filtered = tors.filter(
    (tor) =>
      (!q || `${tor.title} ${tor.agency}`.toLowerCase().includes(q)) && (stage === ALL || tor.stage === stage),
  );

  return (
    <AppShell>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      <PageBody>
        <SummaryGrid>
          <SummaryCard label={t("totalTors")} value={totals.tors} />
          <SummaryCard label={t("totalMatches")} value={totals.matches} hint={t("totalMatchesHint")} />
          <SummaryCard label={t("totalApprovedFeedback")} value={totals.feedback.approved} />
          <SummaryCard
            label={t("totalPendingFeedback")}
            value={totals.feedback.pending}
            hint={t("totalPendingFeedbackHint")}
          />
        </SummaryGrid>

        <Section title={t("torListSection")}>
          {tors.length === 0 ? (
            <EmptyState title={t("noOwnTorsTitle")} description={t("noOwnTorsDescription")} />
          ) : (
            <>
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                pills={pills}
                activePill={stage}
                onPillChange={setStage}
              />

              <p className="mt-3 text-xs text-ink-subtle">{t("itemsCount", { count: filtered.length })}</p>

              <div className="mt-3">
                {filtered.length === 0 ? (
                  <EmptyState title={t("noItemsFound")} />
                ) : (
                  <ItemList>
                    {filtered.map((tor) => (
                      <ItemRow
                        key={tor.id}
                        icon={<FileText size={15} className="text-ink-subtle" />}
                        iconBg="bg-surface-alt"
                        title={tor.title}
                        subtitle={t("rowSubtitle", {
                          agency: tor.agency,
                          matchCount: tor.matchCount,
                          feedbackCount: tor.feedback.approved,
                        })}
                        trailing={
                          <div className="flex items-center gap-3">
                            {tor.feedback.pending > 0 && (
                              <StatusBadge label={t("pendingBadge", { count: tor.feedback.pending })} variant="accent" />
                            )}
                            {tor.topScore !== null && (
                              <span className="text-xs tabular-nums text-ink-muted">
                                {t("topScore", { score: tor.topScore })}
                              </span>
                            )}
                            <StatusBadge label={tor.stage} />
                            <span className="text-xs tabular-nums text-ink-subtle">
                              {isKnown(tor.deadline) ? t("daysSuffix", { days: tor.daysLeft }) : tor.budget}
                            </span>
                          </div>
                        }
                        actions={
                          <Link
                            href={`/tor/${tor.id}?in=app`}
                            className="flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-ink-muted hover:bg-surface-alt hover:text-ink"
                          >
                            {t("viewTor")}
                          </Link>
                        }
                      />
                    ))}
                  </ItemList>
                )}
              </div>
            </>
          )}
        </Section>
      </PageBody>
    </AppShell>
  );
}
