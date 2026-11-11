"use client";

import { Loader2, Sparkles, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { SimilarError, SimilarInput } from "@/lib/similar-actions";

/**
 * The search page's main question for a project manager (issue #255): "here is
 * work we have done — what else is like it?". A pasted description, or the
 * company's own profile; picking a TOR is the button on each card.
 */
export function FindSimilarPanel({
  pending,
  error,
  canUseProfile,
  onSearch,
}: {
  pending: boolean;
  error: SimilarError | null;
  /** An organization account, whose profile may describe its past work. */
  canUseProfile: boolean;
  onSearch: (input: SimilarInput, label: string) => void;
}) {
  const t = useTranslations("FindSimilar");
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    // A label for the banner above the results: the start of what was pasted.
    const label = trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
    onSearch({ text: trimmed }, label);
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Sparkles size={18} className="text-accent" /> {t("title")}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{t("description")}</p>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="find-similar-text" className="sr-only">
          {t("inputLabel")}
        </label>
        <textarea
          id="find-similar-text"
          rows={3}
          maxLength={5000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("placeholder")}
          className="w-full rounded-xl border border-border bg-surface-alt p-3.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-accent/40 focus:bg-surface focus:ring-2 focus:ring-accent/20"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {t(`error.${error}`)}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending || text.trim().length === 0}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {pending ? t("searching") : t("submit")}
          </button>
          {canUseProfile && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onSearch({ fromProfile: true }, t("profileLabel"))}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserRound size={15} />
              {t("useProfile")}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
