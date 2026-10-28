"use client";

import { CheckCircle2, LinkIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type SubmitEvent, useState } from "react";

import { AuthStatus } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPassword } from "@/lib/account-links";

/** Same rule as sign-up and the backend's ResetPasswordDto. */
const MIN_PASSWORD = 8;

export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations("AccountLinks");
  const tc = useTranslations("Common");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkDead, setLinkDead] = useState(false);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token || linkDead) {
    return (
      <>
        <AuthStatus icon={<LinkIcon size={24} />} tone="warn" title={t(linkDead ? "linkExpiredTitle" : "missingTokenTitle")}>
          {linkDead ? error : t("missingTokenBody")}
        </AuthStatus>
        <Link
          href="/forgot-password"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-accent text-base font-semibold text-white transition-colors hover:bg-accent-dark"
        >
          {t("requestNewLink")}
        </Link>
      </>
    );
  }

  if (done) {
    return (
      <>
        <AuthStatus icon={<CheckCircle2 size={26} />} tone="success" title={t("resetDoneTitle")}>
          {t("resetDoneBody")}
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

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(t("passwordTooShort", { min: MIN_PASSWORD }));
    if (password !== confirm) return setError(t("passwordMismatch"));

    setError(null);
    setIsSubmitting(true);
    const result = await resetPassword(token!, password);
    setIsSubmitting(false);
    if (result.ok) return setDone(true);
    setError(result.error);
    // The password already passed the same rule here, so a 400 is the link:
    // expired, used or mistyped. Retrying it can't work; offer a new one.
    if (result.httpStatus === 400) setLinkDead(true);
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-ink">{t("resetTitle")}</h1>
      <p className="mt-1.5 text-base text-ink-muted">{t("resetDescription", { min: MIN_PASSWORD })}</p>

      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">{t("newPasswordLabel")}</span>
          <PasswordInput
            required
            autoFocus
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            showLabel={tc("showPassword")}
            hideLabel={tc("hidePassword")}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">{t("confirmPasswordLabel")}</span>
          <PasswordInput
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            showLabel={tc("showPassword")}
            hideLabel={tc("hidePassword")}
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-accent text-base font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? t("saving") : t("savePassword")}
        </button>
      </form>
    </>
  );
}
