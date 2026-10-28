"use client";

import { BookmarkPlus, Check } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import type { SearchFilters } from "@/lib/search-filters";

type State = { step: "closed" } | { step: "naming"; error?: string } | { step: "saving" } | { step: "saved"; name: string };

/**
 * "Save this search": names what the filters are set to now and keeps it on
 * the account, to be applied again from the saved page.
 */
export function SaveSearchForm({ filters, savedHref }: { filters: SearchFilters; savedHref: string }) {
  const t = useTranslations("PublicPage");
  const [state, setState] = useState<State>({ step: "closed" });
  const [name, setName] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setState({ step: "saving" });
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, filters }),
      });
      if (res.ok) {
        setState({ step: "saved", name: trimmed });
        setName("");
        return;
      }
      // The backend words its own refusals (a taken name, the limit reached).
      const body = await res.json().catch(() => null);
      const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
      setState({ step: "naming", error: typeof message === "string" ? message : t("saveSearchFailed") });
    } catch {
      setState({ step: "naming", error: t("saveSearchFailed") });
    }
  }

  if (state.step === "closed" || state.step === "saved") {
    return (
      <div className="space-y-2">
        {state.step === "saved" && (
          <p className="flex items-start gap-1.5 text-sm text-ink-muted" role="status">
            <Check size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>
              {t("saveSearchDone", { name: state.name })}{" "}
              <Link href={savedHref} className="font-medium text-accent hover:text-accent-dark">
                {t("saveSearchViewSaved")}
              </Link>
            </span>
          </p>
        )}
        <button
          type="button"
          onClick={() => setState({ step: "naming" })}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-alt"
        >
          <BookmarkPlus size={16} />
          {t("saveSearchButton")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <label htmlFor="saved-search-name" className="block text-sm font-bold text-ink">
        {t("saveSearchNameLabel")}
      </label>
      <input
        id="saved-search-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        autoFocus
        placeholder={t("saveSearchNamePlaceholder")}
        aria-invalid={state.step === "naming" && Boolean(state.error)}
        aria-describedby={state.step === "naming" && state.error ? "saved-search-error" : undefined}
        className="w-full rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent/40 focus:bg-surface focus:ring-2 focus:ring-accent/20"
      />
      {state.step === "naming" && state.error && (
        <p id="saved-search-error" className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={state.step === "saving" || !name.trim()}
          className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.step === "saving" ? t("saveSearchSaving") : t("saveSearchSubmit")}
        </button>
        <button
          type="button"
          onClick={() => setState({ step: "closed" })}
          className="rounded-xl px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-alt hover:text-ink"
        >
          {t("cancelButton")}
        </button>
      </div>
    </form>
  );
}
