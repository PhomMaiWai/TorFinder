"use client";

import { CheckCircle2, Clock, MailQuestion, MailCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthStatus } from "@/components/auth/auth-card";
import { ResendVerification } from "@/components/auth/resend-verification";
import { verifyEmail } from "@/lib/account-links";

type State = { step: "ready" | "verifying" } | { step: "verified"; pending: boolean } | { step: "failed"; error: string };

/**
 * Confirms the address with one press rather than on page load: mail scanners
 * open links to check them, and a link that confirmed itself on load would be
 * used up before its owner ever saw it.
 */
export function VerifyEmailPanel({ token }: { token: string | null }) {
  const t = useTranslations("AccountLinks");
  const [state, setState] = useState<State>(
    token ? { step: "ready" } : { step: "failed", error: t("missingTokenBody") },
  );

  async function confirm() {
    setState({ step: "verifying" });
    const result = await verifyEmail(token!);
    setState(result.ok ? { step: "verified", pending: result.status === "pending" } : { step: "failed", error: result.error });
  }

  if (state.step === "verified") {
    return (
      <>
        <AuthStatus
          icon={state.pending ? <Clock size={26} /> : <CheckCircle2 size={26} />}
          tone={state.pending ? "warn" : "success"}
          title={t("verifiedTitle")}
        >
          {t(state.pending ? "verifiedPending" : "verifiedReady")}
        </AuthStatus>
        <Link
          href="/login"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-accent text-base font-semibold text-white transition-colors hover:bg-accent-dark"
        >
          {t("goToLogin")}
        </Link>
      </>
    );
  }

  if (state.step === "failed") {
    return (
      <>
        <AuthStatus icon={<MailQuestion size={26} />} tone="warn" title={t("verifyFailedTitle")}>
          {state.error}
        </AuthStatus>
        <p className="mb-3 mt-6 text-sm text-ink-muted">{t("resendPrompt")}</p>
        <ResendVerification />
      </>
    );
  }

  return (
    <>
      <AuthStatus icon={<MailCheck size={26} />} tone="accent" title={t("verifyTitle")}>
        {t("verifyDescription")}
      </AuthStatus>
      <button
        type="button"
        onClick={confirm}
        disabled={state.step === "verifying"}
        className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-accent text-base font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state.step === "verifying" ? t("verifying") : t("verifyButton")}
      </button>
    </>
  );
}
