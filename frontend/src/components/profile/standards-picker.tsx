"use client";

import { Check, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { STANDARD_GROUPS, type Certification, type Standard, type StandardGroup } from "@/types/tor";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";
const GROUPS = Object.entries(STANDARD_GROUPS) as [
  StandardGroup,
  (typeof STANDARD_GROUPS)[StandardGroup],
][];
const TOTAL = GROUPS.reduce((count, [, standards]) => count + standards.length, 0);

/** "iso27001", "ISO 27001" and "ISO/IEC 27001" all find the same standard. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s/\-:.]+/g, "").replace(/^iso(iec)?|^iec/, "");
}

type Props = {
  /** `undefined` until the company answers; `[]` means it answered "none". */
  value: Certification[] | undefined;
  onChange: (next: Certification[]) => void;
};

/**
 * Every standard a TOR is likely to ask for, grouped and searchable, so the
 * eligibility check can tell a company whether it qualifies. Only standards
 * are handled here; the manufacturer's dealer letter lives with the other
 * bidding qualifications and is passed through untouched.
 */
export function StandardsPicker({ value, onChange }: Props) {
  const t = useTranslations("ProfilePage");
  const tOptions = useTranslations("CompanyProfileOptions");
  const [query, setQuery] = useState("");

  const selected = useMemo(() => new Set(value ?? []), [value]);
  const selectedCount = GROUPS.reduce(
    (count, [, standards]) => count + standards.filter(({ id }) => selected.has(id)).length,
    0,
  );

  const needle = normalize(query);
  const visibleGroups = useMemo(
    () =>
      needle
        ? GROUPS.map(
            ([group, standards]) =>
              [group, standards.filter(({ id, label }) => normalize(label).includes(needle) || id.includes(needle))] as const,
          ).filter(([, standards]) => standards.length > 0)
        : GROUPS,
    [needle],
  );

  function toggle(id: Standard) {
    const current = value ?? [];
    onChange(current.includes(id) ? current.filter((cert) => cert !== id) : [...current, id]);
  }

  /** Clears every standard but keeps the dealer letter, which isn't a standard. */
  function markNone() {
    onChange((value ?? []).filter((cert) => cert === "dealer"));
  }

  const requestHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    t("standardsRequestSubject", { name: query.trim() || "-" }),
  )}`;
  const answeredNone = value !== undefined && selectedCount === 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="mb-4 text-sm text-ink-muted">{t("standardsDescription")}</p>

      <label className="relative block">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("standardsSearchPlaceholder")}
          aria-label={t("standardsSearchPlaceholder")}
          className="h-11 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
        />
      </label>

      <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          {t("standardsCount", { count: TOTAL })}
          {selectedCount > 0 && (
            <span className="ml-2 font-medium text-accent-text">
              {t("standardsSelected", { count: selectedCount })}
            </span>
          )}
        </p>
        <a
          href={requestHref}
          className="text-sm font-medium text-ink-muted underline underline-offset-4 transition-colors hover:text-ink"
        >
          {t("standardsRequest")}
        </a>
      </div>

      {visibleGroups.length === 0 ? (
        <p className="rounded-lg bg-surface-alt px-4 py-6 text-center text-sm text-ink-muted">
          {t("standardsNoResults", { query: query.trim() })}
        </p>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map(([group, standards]) => (
            <div key={group}>
              <p className="mb-2 text-sm font-medium text-ink">{tOptions(`standardGroup_${group}`)}</p>
              <div className="flex flex-wrap gap-2">
                {standards.map(({ id, label }) => {
                  const active = selected.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      aria-pressed={active}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-sm transition-colors ${
                        active
                          ? "border-accent/30 bg-accent-soft text-accent-text"
                          : "border-border bg-surface-alt text-ink-muted hover:border-ink-subtle hover:text-ink"
                      }`}
                    >
                      {active ? <Check size={13} /> : <Plus size={13} />}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <button
          type="button"
          onClick={markNone}
          aria-pressed={answeredNone}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            answeredNone ? "bg-accent-soft text-accent-text" : "border border-border text-ink-muted hover:text-ink"
          }`}
        >
          {answeredNone && <Check size={13} />}
          {t("noStandardsLabel")}
        </button>
      </div>
    </div>
  );
}
