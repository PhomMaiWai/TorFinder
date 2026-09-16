"use client";

import { Bookmark, Building2, Clock, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { PageBody, PageHeader } from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { isKnown, torAmount } from "@/lib/tor-ui";
import { useSavedTors, type SavedTorsScope } from "@/lib/use-saved-tors";
import type { TorRecord } from "@/types/tor";

function SavedList({
  tors,
  scope,
  showHeader = true,
}: {
  tors: TorRecord[];
  scope: SavedTorsScope;
  showHeader?: boolean;
}) {
  const { savedIds, toggleSaved } = useSavedTors(scope);
  const t = useTranslations("SavedPage");
  const savedTors = tors.filter((tor) => savedIds.includes(tor.id));

  return (
    <>
      {showHeader && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {t("savedListTitle")}
          </h1>
          <p className="mt-2 text-base text-ink-muted">{t("savedListDescription")}</p>
        </div>
      )}

      {savedTors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-transparent py-24 text-center">
          <Bookmark size={32} className="mx-auto mb-4 text-ink-subtle" />
          <h3 className="text-base font-semibold text-ink">{t("emptyTitle")}</h3>
          <p className="mt-1 text-base text-ink-muted">
            {t("emptyDescription")}
          </p>
          <Link
            href="/public"
            className="mt-4 inline-block rounded-lg bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink"
          >
            {t("goToSearchCta")}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {savedTors.map((tor) => (
            <article
              key={tor.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6"
            >
              <div className="min-w-0 flex-1">
                <Link href={`/tor/${tor.id}`} className="block">
                  <h3 className="text-base font-bold text-ink hover:text-accent sm:text-lg">
                    {tor.title}
                  </h3>
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px] text-ink-muted">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={15} className="text-ink-subtle" />
                    {tor.agency}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={15} className="text-ink-subtle" />
                    {isKnown(tor.deadline) ? t("daysLeft", { days: tor.daysLeft }) : t("deadlineUnknown")}
                  </span>
                  <span className="font-semibold text-ink">{torAmount(tor).value}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/tor/${tor.id}`}
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink"
                >
                  {t("viewDetailsCta")}
                </Link>
                <button
                  onClick={() => toggleSaved(tor.id)}
                  aria-label={t("removeAriaLabel")}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-alt hover:text-danger"
                >
                  <X size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export function SavedContent({ tors }: { tors: TorRecord[] }) {
  const params = useSearchParams();
  const t = useTranslations("SavedPage");
  const scope: SavedTorsScope = params.get("scope") === "org" ? "org" : "public";

  if (scope === "org") {
    return (
      <AppShell>
        <PageHeader title={t("orgPageTitle")} description={t("savedListDescription")} />
        <PageBody>
          <SavedList tors={tors} scope="org" showHeader={false} />
        </PageBody>
      </AppShell>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-alt">
      <SiteNavbar />
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-4xl px-6 sm:px-8">
          <SavedList tors={tors} scope="public" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
