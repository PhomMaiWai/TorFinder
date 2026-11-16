"use client";

import { useTranslations } from "next-intl";
import { type SubmitEvent, useState } from "react";

import { changePassword } from "@/app/profile/actions";
import { Section } from "@/components/layout/app-page";
import { PasswordInput } from "@/components/ui/password-input";
import { resetSession } from "@/lib/use-session";

const MIN_LENGTH = 8;

/** ASVS 6.2.2 / 6.2.3: change the password while signed in, with the current one as proof. */
export function ChangePasswordSection() {
  const t = useTranslations("ProfilePage");
  const tCommon = useTranslations("Common");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword.length < MIN_LENGTH) return setError(t("newPasswordTooShort"));
    if (newPassword !== confirmPassword) return setError(t("passwordMismatch"));

    setSaving(true);
    const result = await changePassword(currentPassword, newPassword);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? t("changePasswordFailed"));
      return;
    }
    // The backend ended every session, this one included.
    resetSession();
    setDone(true);
  }

  const passwordProps = {
    showLabel: tCommon("showPassword"),
    hideLabel: tCommon("hidePassword"),
    required: true,
    maxLength: 128,
  };

  return (
    <Section title={t("changePasswordSectionTitle")}>
      <div className="rounded-xl border border-border bg-surface p-5">
        {done ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-success">{t("passwordChangedConfirmation")}</p>
            <a
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
            >
              {t("signInAgainButton")}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 sm:max-w-md">
            <p className="text-sm text-ink-muted">{t("changePasswordDescription")}</p>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{t("currentPasswordLabel")}</span>
              <PasswordInput
                {...passwordProps}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{t("newPasswordLabel")}</span>
              <PasswordInput
                {...passwordProps}
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{t("confirmNewPasswordLabel")}</span>
              <PasswordInput
                {...passwordProps}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
            >
              {t("changePasswordButton")}
            </button>
          </form>
        )}
      </div>
    </Section>
  );
}
