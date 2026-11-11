"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import type { ProfileProgressItem } from "@/lib/profile-progress";

/**
 * Each missing profile item as "add this → matching can do that", linking to
 * the field. The benefit is the point: a bare checklist doesn't tell the
 * company why the blank matters, so it stays blank.
 */
export function ProfileNudges({
  items,
  showDone = false,
}: {
  items: ProfileProgressItem[];
  /** Also list what's already filled in, ticked, below the nudges. */
  showDone?: boolean;
}) {
  const t = useTranslations("ProfileProgress");
  const missing = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);

  return (
    <div className="space-y-2">
      {missing.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <Check size={14} strokeWidth={3} />
          {t("allDone")}
        </p>
      ) : (
        <ul className="space-y-2">
          {missing.map(({ key, href }) => (
            <li key={key}>
              <Link
                href={href}
                className="group block rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-accent/40 hover:bg-surface-alt"
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  {t(`action_${key}`)}
                  <ArrowRight
                    size={13}
                    className="shrink-0 text-accent transition-transform group-hover:translate-x-0.5"
                  />
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">{t(`benefit_${key}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showDone && done.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {done.map(({ key }) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                <Check size={9} strokeWidth={3} />
              </span>
              <span className="text-ink-muted">{t(`label_${key}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
