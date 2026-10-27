"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type SubmitEvent, useState } from "react";

import { AuthStatus } from "@/components/auth/auth-card";
import { requestPasswordReset } from "@/lib/account-links";

export function ForgotPasswordForm() {
  const t = useTranslations("AccountLinks");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await requestPasswordReset(email);
    setIsSubmitting(false);
    if (result.ok) setSentTo(email.trim());
    else setError(result.error);
  }

  if (sentTo) {
    return (
      <>
        <AuthStatus icon={<MailCheck size={26} />} tone="success" title={t("forgotSentTitle")}>
          {t.rich("forgotSentBody", {
            email: sentTo,
            bold: (chunks) => <span className="font-medium text-ink">{chunks}</span>,
          })}
        </AuthStatus>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-6 w-full text-sm font-medium text-accent hover:text-accent-dark"
        >
          {t("tryAnotherEmail")}
        </button>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-ink">{t("forgotTitle")}</h1>
      <p className="mt-1.5 text-base text-ink-muted">{t("forgotDescription")}</p>

      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">{t("emailLabel")}</span>
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-12 w-full rounded-lg border border-border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-accent text-base font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? t("sending") : t("sendResetLink")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {t("rememberedPassword")}{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-dark">
          {t("signIn")}
        </Link>
      </p>
    </>
  );
}
