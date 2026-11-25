import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { DeleteTorButton } from "@/components/admin/delete-tor-button";
import { GprocCapture } from "@/components/admin/gproc-capture";
import { AdminPageShell } from "@/components/layout/admin-page";
import { fetchDeletedTors, fetchNotSoftwareTors } from "@/lib/tor-admin-api";
import { fetchTorList } from "@/lib/tor-api";
import { stageBadgeCls } from "@/lib/tor-ui";
import { displayValue, valueLabel } from "@/lib/value-labels";

import { syncFromEgp, syncFromMea } from "./actions";

const PAGE_SIZE = 20;

/** Labels are AdminTor.tabs.<id> in messages/*.json. */
const TABS = [
  { id: "manual" },
  { id: "egp" },
  { id: "gproc" },
  { id: "mea" },
  { id: "all" },
  { id: "not-software" },
  { id: "deleted" },
] as const;

/** One button per portal, in the order their records outrank each other. */
const IMPORTS = [
  { id: "egp", label: "e-GP", action: syncFromEgp },
  { id: "mea", label: null, action: syncFromMea },
] as const;


type TabId = (typeof TABS)[number]["id"];

/** Anything else in the query string — a stale link, a typo — falls back below. */
const isTab = (value: string | undefined): value is TabId =>
  TABS.some((tab) => tab.id === value);

export default async function AdminTorListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; source?: string }>;
}) {
  const { page: pageParam, source: sourceParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const source = isTab(sourceParam) ? sourceParam : "manual";

  // The trash and the not-software list have their own guarded routes; the
  // rest of the tabs are one listing with a source filter.
  const isTrash = source === "deleted";
  const isOwnList = isTrash || source === "not-software";
  const [t, tv] = await Promise.all([getTranslations("AdminTor"), getTranslations("Values")]);
  const deleteLabels = {
    delete: t("deleteLabel"),
    confirm: t("deleteConfirm"),
    cancel: t("deleteCancel"),
    restore: t("restoreLabel"),
  };
  const tors = isTrash
    ? await fetchDeletedTors()
    : source === "not-software"
      ? await fetchNotSoftwareTors()
      : await fetchTorList(page, PAGE_SIZE, source === "all" ? undefined : source);

  return (
    <AdminPageShell title={t("listTitle")} description={t("listDescription")}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                href={`/admin/tor?source=${tab.id}`}
                className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  source === tab.id
                    ? "bg-ink text-surface"
                    : "text-ink-muted hover:bg-surface-alt hover:text-ink"
                }`}
              >
                {t(`tabs.${tab.id}`)}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
          {IMPORTS.map((portal) => (
            <form key={portal.id} action={portal.action}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-alt"
              >
                <RefreshCw size={16} />
                {t("pullFrom", { portal: portal.label ?? t("portalMea") })}
              </button>
            </form>
          ))}
          <Link
            href="/admin/tor/new"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            <Plus size={16} />
            {t("addTor")}
          </Link>
          </div>
        </div>

        {source === "gproc" && <GprocCapture />}

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {tors.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">
              {isTrash
                ? t("trashEmpty")
                : source === "not-software"
                  ? t("noNotSoftware")
                  : t("noTors")}
            </p>
          ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-alt text-left text-xs text-ink-muted">
                      <th className="px-5 py-3 font-medium">{tv("field.title")}</th>
                      <th className="px-5 py-3 font-medium">{tv("field.agency")}</th>
                      <th className="px-5 py-3 font-medium">{t("colStatus")}</th>
                      <th className="px-5 py-3 font-medium">{tv("field.deadline")}</th>
                      <th className="px-5 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tors.map((tor) => (
                      <tr key={tor.id} className="border-b border-border last:border-0">
                        <td className="max-w-xs truncate px-5 py-3 font-medium text-ink">{tor.title}</td>
                        <td className="px-5 py-3 text-ink-muted">{tor.agency}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-2xs font-semibold ${stageBadgeCls(tor.stage)}`}
                          >
                            {valueLabel(tv, "stage", tor.stage)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-ink-muted">{displayValue(tv, tor.deadline)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="inline-flex items-center gap-4">
                            <Link
                              href={`/admin/tor/${tor.id}`}
                              className="font-medium text-accent hover:text-accent-dark"
                            >
                              {t("viewDetails")}
                            </Link>
                            <DeleteTorButton
                              torId={tor.id}
                              deleted={isTrash}
                              labels={deleteLabels}
                            />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          )}
        </div>

        <div className={`flex items-center justify-between ${isOwnList ? "hidden" : ""}`}>
          <Link
            href={`/admin/tor?source=${source}&page=${Math.max(1, page - 1)}`}
            aria-disabled={page <= 1}
            className={`flex items-center gap-1 text-sm font-medium ${
              page <= 1 ? "pointer-events-none text-ink-subtle" : "text-ink-muted hover:text-ink"
            }`}
          >
            <ChevronLeft size={16} />
            {t("previous")}
          </Link>
          <span className="text-sm text-ink-muted">{t("pageN", { page })}</span>
          <Link
            href={`/admin/tor?source=${source}&page=${page + 1}`}
            aria-disabled={tors.length < PAGE_SIZE}
            className={`flex items-center gap-1 text-sm font-medium ${
              tors.length < PAGE_SIZE ? "pointer-events-none text-ink-subtle" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t("next")}
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </AdminPageShell>
  );
}
