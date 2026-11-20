import { ExternalLink as ExternalLinkIcon, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AuthCard, AuthStatus } from "@/components/auth/auth-card";
import { leavingTarget } from "@/lib/external-link";

import { StayButton } from "./stay-button";

/**
 * ASVS 3.7.3: every link out of TorFinder (e-GP, MEA, LINE, a certificate's
 * verification page) lands here first. It says where the link goes and lets
 * the person continue or go back. Nothing redirects by itself, so the page
 * can't be used to bounce someone to a site they didn't choose; only
 * http(s) destinations are offered.
 */
export default async function LeavingPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const [{ to }, t] = await Promise.all([searchParams, getTranslations("LeavingPage")]);
  const target = leavingTarget(to);

  if (!target) {
    return (
      <AuthCard>
        <AuthStatus icon={<ShieldAlert size={22} />} tone="danger" title={t("invalidTitle")}>
          {t("invalidDescription")}
        </AuthStatus>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("title")}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t("description")}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-alt px-4 py-3">
          <p className="text-xs font-medium text-ink-muted">{t("destination")}</p>
          <p className="mt-1 text-base font-semibold text-ink">{target.hostname}</p>
          <p className="mt-1 break-all text-xs text-ink-subtle">{target.href}</p>
        </div>
        {target.protocol === "http:" && <p className="text-xs text-danger">{t("insecure")}</p>}
        <div className="flex flex-wrap gap-3">
          <a
            href={target.href}
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
          >
            <ExternalLinkIcon size={15} />
            {t("continue", { host: target.hostname })}
          </a>
          <StayButton label={t("stay")} />
        </div>
      </div>
    </AuthCard>
  );
}
