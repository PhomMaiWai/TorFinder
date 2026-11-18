import { Lock, PenLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/lib/datetime";
import { valueLabel } from "@/lib/value-labels";
import type { TorRecord } from "@/types/tor";

/**
 * Who last corrected this record and when, and which fields are now locked
 * against re-imports. Nothing at all for a record no admin has touched.
 */
export function TorCorrectionInfo({
  tor,
}: {
  tor: Pick<TorRecord, "lastEdited" | "lockedFields" | "classification">;
}) {
  const t = useTranslations("AdminTor");
  const tv = useTranslations("Values");
  const locale = useLocale() as Locale;

  if (
    !tor.lastEdited &&
    !tor.lockedFields?.length &&
    tor.classification !== "not-software"
  )
    return null;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-alt px-5 py-4 text-sm">
      {tor.classification === "not-software" && (
        <p className="font-semibold text-danger">
          {t("notSoftwareNotice", { label: valueLabel(tv, "classification", "not-software") })}
        </p>
      )}
      {tor.lastEdited && (
        <p className="flex items-center gap-2 text-ink-muted">
          <PenLine size={14} className="shrink-0" />
          {t("lastEditedBy")}{" "}
          <span className="font-medium text-ink">{tor.lastEdited.by}</span>{" "}
          {t("editedAt", { date: formatDateTime(tor.lastEdited.at, locale) })}
        </p>
      )}
      {!!tor.lockedFields?.length && (
        <p className="flex items-start gap-2 text-ink-muted">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>
            {t("lockedFields")}{" "}
            {tor.lockedFields.map((field) => valueLabel(tv, "field", field)).join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}
