"use client";

import { LogOut, Monitor } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type SubmitEvent, useState } from "react";

import { type SessionList, endMySessions } from "@/app/account/actions";
import { Section } from "@/components/layout/app-page";
import { PasswordInput } from "@/components/ui/password-input";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/lib/datetime";
import { resetSession } from "@/lib/use-session";

type Target = { id: string; current: boolean } | "others";

/**
 * ASVS 7.5.2: where this account is signed in, and a way to end any of those
 * sessions. Ending one asks for the password again (a Google-only account
 * needs a sign-in in the last few minutes instead, checked by the backend).
 */
export function SessionsSection({ list }: { list: SessionList | null }) {
  const t = useTranslations("AccountPage");
  const tCommon = useTranslations("Common");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [target, setTarget] = useState<Target | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const sessions = list?.sessions ?? [];
  const others = sessions.filter((session) => !session.current).length;

  async function end(chosen: Target) {
    setBusy(true);
    setMessage(null);
    const result = await endMySessions(chosen, password);
    setBusy(false);
    if (!result.ok) {
      setMessage({ text: result.error ?? t("sessionsEndFailed"), ok: false });
      return;
    }
    setTarget(null);
    setPassword("");
    if (result.signedOut) {
      resetSession();
      router.push("/login");
      return;
    }
    setMessage({ text: t("sessionsEnded"), ok: true });
    router.refresh();
  }

  function choose(chosen: Target) {
    setMessage(null);
    setPassword("");
    // Without a password to ask for, the backend checks for a recent sign-in instead.
    if (list?.needsPassword) setTarget(chosen);
    else void end(chosen);
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (target) void end(target);
  }

  return (
    <Section
      title={t("sessionsSectionTitle")}
      action={
        others > 0 && (
          <button
            onClick={() => choose("others")}
            disabled={busy}
            className="text-sm font-medium text-danger transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {t("sessionsEndOthers")}
          </button>
        )
      }
    >
      <div className="rounded-xl border border-border bg-surface">
        <p className="border-b border-border px-5 py-3 text-sm text-ink-muted">{t("sessionsDescription")}</p>
        {list === null ? (
          <p className="px-5 py-4 text-sm text-danger">{t("sessionsLoadFailed")}</p>
        ) : sessions.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-muted">{t("sessionsEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center gap-3 px-5 py-3">
                <Monitor size={16} className="shrink-0 text-ink-subtle" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {session.device ?? t("sessionsUnknownDevice")}
                    {session.current && (
                      <span className="ml-2 rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                        {t("sessionsThisDevice")}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {[t("sessionsSignedIn", { date: formatDateTime(session.createdAt, locale) }), session.ip]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  onClick={() => choose({ id: session.id, current: session.current })}
                  disabled={busy}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                >
                  <LogOut size={14} />
                  {t("sessionsEnd")}
                </button>
              </li>
            ))}
          </ul>
        )}

        {target && (
          <form onSubmit={handleSubmit} className="grid gap-3 border-t border-border px-5 py-4 sm:max-w-md">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{t("sessionsPasswordLabel")}</span>
              <PasswordInput
                showLabel={tCommon("showPassword")}
                hideLabel={tCommon("hidePassword")}
                required
                maxLength={128}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-danger px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {target === "others" ? t("sessionsEndOthers") : t("sessionsEnd")}
              </button>
              <button
                type="button"
                onClick={() => setTarget(null)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-ink-muted hover:text-ink"
              >
                {t("sessionsCancel")}
              </button>
            </div>
          </form>
        )}

        {message && (
          <p role="status" className={`border-t border-border px-5 py-3 text-sm ${message.ok ? "text-success" : "text-danger"}`}>
            {message.text}
          </p>
        )}
      </div>
    </Section>
  );
}
