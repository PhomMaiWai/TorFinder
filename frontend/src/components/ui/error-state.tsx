"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * What a reader sees when a page couldn't load. It says the site is having
 * trouble — never that their announcement or their saved list is gone, which is
 * what an empty page would have implied — and offers the one thing that
 * sometimes helps: trying again.
 *
 * The message stays generic on purpose: `error.message` from a server component
 * is redacted in production anyway, and a stack trace helps nobody here. The
 * digest is printed small, because it is the one string that lets a developer
 * find this exact failure in the server log.
 */
export function ErrorState({ error, reset }: Props) {
  const t = useTranslations("ErrorState");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-danger-soft">
        <AlertTriangle size={22} className="text-danger" />
      </span>

      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold text-ink">{t("title")}</h1>
        <p className="text-sm text-ink-muted">{t("description")}</p>
      </div>

      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
      >
        <RefreshCw size={16} />
        {t("retry")}
      </button>

      {error.digest && (
        <p className="font-mono text-2xs text-ink-subtle">
          {t("reference")}: {error.digest}
        </p>
      )}
    </div>
  );
}
