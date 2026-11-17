"use client";

import { CheckCircle2, CircleDashed, CircleMinus, Download, FolderOpen, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { Coverage, CoverageStatus } from "@/types/library";

const STATUS_ICON: Record<CoverageStatus, React.ElementType> = {
  ready: CheckCircle2,
  partial: CircleMinus,
  missing: XCircle,
  manual: CircleDashed,
};

const STATUS_STYLE: Record<CoverageStatus, string> = {
  ready: "text-success",
  partial: "text-warn",
  missing: "text-danger",
  manual: "text-ink-subtle",
};

/**
 * On a TOR, for a signed-in company: which of its qualifications the
 * proposal library already covers — "4 of 7 ready" — with the library items
 * behind each, and a starter pack of those files to begin the bid from (#259).
 */
export function CoveragePanel({ torId }: { torId: string }) {
  const t = useTranslations("Library");
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/library/coverage/${encodeURIComponent(torId)}`, { cache: "no-store" }).catch(() => null);
      if (cancelled) return;
      if (res?.ok) setCoverage((await res.json()) as Coverage);
      else setFailed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [torId]);

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <FolderOpen size={18} className="text-ink-subtle" />
          {t("coverageHeading")}
        </h2>
        {coverage && coverage.total > 0 && (
          <a
            href={`/api/library/starter-pack/${encodeURIComponent(torId)}`}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            <Download size={14} />
            {t("starterPack")}
          </a>
        )}
      </div>

      {!coverage && !failed && (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 size={14} className="animate-spin" />
          {t("coverageLoading")}
        </p>
      )}
      {failed && <p className="text-sm text-danger">{t("coverageFailed")}</p>}

      {coverage && coverage.total === 0 && (
        <p className="text-sm text-ink-muted">{coverage.extracted ? t("coverageNoLines") : t("coverageNotRead")}</p>
      )}

      {coverage && coverage.total > 0 && (
        <>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{t("coverageReady", { ready: coverage.ready, total: coverage.total })}</span>
          </div>
          <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-surface-alt" aria-hidden>
            <div className="bg-success" style={{ width: `${(coverage.ready / coverage.total) * 100}%` }} />
            <div className="bg-warn" style={{ width: `${(coverage.partial / coverage.total) * 100}%` }} />
            <div className="bg-danger/70" style={{ width: `${(coverage.missing / coverage.total) * 100}%` }} />
          </div>
          <p className="mb-4 text-xs text-ink-muted">
            {t("coverageBreakdown", { partial: coverage.partial, missing: coverage.missing, manual: coverage.manual })}
          </p>

          <ul className="space-y-3">
            {coverage.items.map((item, index) => {
              const Icon = STATUS_ICON[item.status];
              return (
                <li key={index} className="flex gap-3">
                  <Icon size={18} className={`mt-0.5 shrink-0 ${STATUS_STYLE[item.status]}`} aria-label={t(`status_${item.status}`)} />
                  <div className="min-w-0 text-sm">
                    <p className="break-words text-ink">{item.line}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      <span className={`font-medium ${STATUS_STYLE[item.status]}`}>{t(`status_${item.status}`)}</span> · {item.note}
                    </p>
                    {item.evidence.length > 0 && (
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        {item.evidence.map((entry) => `${entry.label}${entry.hasFile ? "" : ` (${t("noFileShort")})`}`).join(" · ")}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-sm text-ink-muted">
            {t("coverageFooter")}{" "}
            <Link href="/library" className="font-medium text-accent-text underline underline-offset-4">
              {t("openLibrary")}
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
