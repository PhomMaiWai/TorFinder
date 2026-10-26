import { Target, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";

import type { BidInsight } from "@/types/tor";

const BAHT = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

const pct = (value: number) => Math.round(value * 100);

const COMPETITION_CLS = {
  blue: "bg-accent-soft text-accent",
  moderate: "bg-warn-soft text-warn",
  red: "bg-danger-soft text-danger",
} as const;

/**
 * What to bid, and how contested this kind of work has been: three price
 * points from past winning bids, each with the share of those winners it
 * would have undercut, then who has been winning and for how much.
 */
export function BidInsightPanel({ insight }: { insight: BidInsight }) {
  const t = useTranslations("TorDetailPage");

  if (insight.status !== "ok" || !insight.base) {
    return (
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
          <Target size={18} className="text-ink-subtle" />
          {t("bidInsightHeading")}
        </h2>
        {insight.notes.map((note) => (
          <p key={note} className="text-sm leading-relaxed text-ink-muted">
            {note}
          </p>
        ))}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-ink">
        <Target size={18} className="text-ink-subtle" />
        {t("bidInsightHeading")}
      </h2>
      <p className="mb-3 text-xs text-ink-muted">
        {t("bidInsightBase", {
          kind: t(insight.baseKind === "reference" ? "bidBaseReference" : "bidBaseBudget"),
          amount: BAHT.format(insight.base),
        })}
      </p>

      <ul className="space-y-2">
        {insight.pricePoints.map((point) => {
          const recommended = point.label === "recommended";
          return (
            <li
              key={point.label}
              className={`rounded-lg border p-3 ${recommended ? "border-accent bg-accent-soft" : "border-border"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-xs font-semibold ${recommended ? "text-accent" : "text-ink-muted"}`}>
                  {t(`bidPoint_${point.label}`)}
                </span>
                <span className="text-2xs text-ink-subtle">
                  {t("bidPointDiscount", { discount: pct(1 - point.ratio) })}
                </span>
              </div>
              <p className="mt-0.5 text-lg font-bold text-ink">{BAHT.format(point.price)}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-alt">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct(point.winChance)}%` }} />
              </div>
              <p className="mt-1 text-2xs text-ink-muted">{t("bidWinChance", { chance: pct(point.winChance) })}</p>
            </li>
          );
        })}
      </ul>

      {insight.competition && (
        <div className="mt-4 border-t border-border pt-4">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COMPETITION_CLS[insight.competition]}`}>
            {t(`competition_${insight.competition}`)}
          </span>
          <p className="mt-2 text-sm text-ink-muted">
            {t("bidDiscountStat", {
              average: pct(insight.averageDiscount ?? 0),
              median: pct(insight.medianDiscount ?? 0),
            })}
          </p>
          <p className="text-sm text-ink-muted">
            {t("bidWinnersStat", { count: insight.distinctWinners, peers: insight.peerCount })}
          </p>
        </div>
      )}

      {insight.topWinners.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Trophy size={13} className="text-ink-subtle" />
            {t("bidTopWinners")}
          </h3>
          <ul className="space-y-1">
            {insight.topWinners.map((winner) => (
              <li key={winner.vendor} className="flex justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-ink">{winner.vendor}</span>
                <span className="shrink-0 text-ink-muted">{t("bidWins", { count: winner.wins })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insight.recentAwards.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-xs font-semibold text-ink">{t("bidRecentAwards")}</h3>
          <ul className="space-y-2">
            {insight.recentAwards.map((award) => (
              <li key={`${award.title}-${award.awarded}`} className="text-sm">
                <p className="line-clamp-1 text-ink">{award.vendor ?? t("bidUnknownVendor")}</p>
                <p className="line-clamp-1 text-xs text-ink-subtle">{award.title}</p>
                <p className="text-xs text-ink-muted">
                  {t("bidAwardRow", { awarded: BAHT.format(award.awarded), discount: pct(award.discount) })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-ink-subtle">{t("bidInsightNote")}</p>
    </section>
  );
}
