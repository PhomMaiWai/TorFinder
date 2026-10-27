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
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-60"
      aria-label={locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
    >
      {locale === "th" ? "EN" : "TH"}
    </button>
  );
}
