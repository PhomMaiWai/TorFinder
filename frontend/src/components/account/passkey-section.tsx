"use client";

import { KeyRound, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useEffect, useState, useSyncExternalStore } from "react";

import { Section } from "@/components/layout/app-page";
import type { Locale } from "@/i18n/config";
import { formatDate, timeAgo } from "@/lib/datetime";
import {
  type PasskeyFailureResult,
  type PasskeyInfo,
  type PasskeyResult,
  addPasskey,
  listPasskeys,
  passkeysSupported,
  removePasskey,
  stepUp,
} from "@/lib/passkeys-client";

const noSubscription = () => () => {};

/**
 * A staff member's passkeys (ASVS 6.3.3 at Level 3): add one on this device,
 * see where they were used, remove one. Adding a second or removing one needs
 * a fresh passkey check, which is asked for here and then retried.
 */
/** `forCompany`: a company account, for which a passkey is optional (ASVS 6.3.3). */
export function PasskeySection({ setupRequired, forCompany = false }: { setupRequired: boolean; forCompany?: boolean }) {
  const t = useTranslations("Passkeys");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<PasskeyInfo[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Fixed for the page's life; the server render assumes support so nothing flashes.
  const supported = useSyncExternalStore(noSubscription, passkeysSupported, () => true);

  useEffect(() => {
    listPasskeys().then((list) => setPasskeys(list ?? []));
  }, []);

  function message(result: PasskeyFailureResult): string {
    if (result.message) return result.message;
    if (result.reason === "cancelled") return t("cancelled");
    if (result.reason === "unsupported") return t("unsupported");
    if (result.reason === "already-registered") return t("alreadyRegistered");
    return t("failed");
  }

  /** Runs a passkey change; if the server wants a fresh check first, does one and tries once more. */
  async function withFreshCheck<T>(run: () => Promise<PasskeyResult<T>>): Promise<PasskeyResult<T>> {
    const first = await run();
    if (first.ok || first.code !== "step-up-required") return first;
    const verified = await stepUp();
    if (!verified.ok) return { ok: false, reason: verified.reason, message: verified.message ?? t("stepUpFailed") };
    return run();
  }

  async function handleAdd(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const result = await withFreshCheck(() => addPasskey(name.trim() || t("namePlaceholder")));
    setBusy(false);
    if (!result.ok) return setError(message(result));
    setPasskeys(result.data);
    setName("");
    setNotice(t("addedConfirmation"));
    // The session is now passkey-verified; let the sidebar and the console know.
    if (setupRequired) router.refresh();
  }

  async function handleRemove(id: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    const result = await withFreshCheck(() => removePasskey(id));
    setBusy(false);
    if (!result.ok) return setError(message(result));
    setPasskeys(result.data);
  }

  return (
    <Section title={t("sectionTitle")}>
      <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-ink-muted">{t(forCompany ? "descriptionCompany" : "description")}</p>

        {setupRequired && (
          <p role="status" className="rounded-lg bg-accent-soft px-4 py-2.5 text-sm font-medium text-accent-text">
            {forCompany ? t("setupRequiredCompany") : t("setupRequired")}
          </p>
        )}
        {!supported && (
          <p role="alert" className="rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger">
            {t("unsupported")}
          </p>
        )}

        {passkeys && passkeys.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center gap-3 px-4 py-3">
                <KeyRound size={16} className="shrink-0 text-ink-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{passkey.name}</p>
                  <p className="text-xs text-ink-muted">
                    {[
                      t("addedInfo", { date: formatDate(passkey.createdAt, locale) ?? "" }),
                      passkey.lastUsedAt && t("lastUsedInfo", { date: timeAgo(passkey.lastUsedAt, locale) }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleRemove(passkey.id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-danger disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {t("removeButton")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          passkeys && <p className="text-sm text-ink-subtle">{t("empty")}</p>
        )}

        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-medium text-ink">
            {t("nameLabel")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder={t("namePlaceholder")}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !supported}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <KeyRound size={16} />
            {busy ? t("waiting") : t("addButton")}
          </button>
        </form>

        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm font-medium text-success">
            {notice}
          </p>
        )}
      </div>
    </Section>
  );
}
