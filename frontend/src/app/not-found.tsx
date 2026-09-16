import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

/**
 * A page that isn't there. Distinct from the error screen on purpose: nothing
 * is broken and retrying won't help, so this offers somewhere to go instead of
 * a retry button.
 */
export default async function NotFound() {
  const t = await getTranslations("NotFoundPage");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-surface-alt">
          <FileQuestion size={22} className="text-ink-muted" />
        </span>

        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-ink">{t("title")}</h1>
          <p className="text-sm text-ink-muted">{t("description")}</p>
        </div>

        <Link
          href="/public"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
        >
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
