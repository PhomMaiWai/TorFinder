"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setUserLocale } from "@/i18n/locale";
import type { Locale } from "@/i18n/config";

export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const nextLocale: Locale = locale === "th" ? "en" : "th";

  function handleClick() {
    startTransition(() => {
      setUserLocale(nextLocale);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-white px-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-alt disabled:opacity-60 dark:border-border dark:bg-transparent"
      aria-label={locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
    >
      {locale === "th" ? "EN" : "TH"}
    </button>
  );
}
