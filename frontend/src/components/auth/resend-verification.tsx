"use client";

import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { type SubmitEvent, useState } from "react";

import { resendVerification } from "@/lib/account-links";

/**
 * Sends a fresh verification link. Given the address, it is one button; without
 * it, it asks for one first. The answer is the same whether or not the address
 * has an account waiting, so it says "sent" either way.
 */
export function ResendVerification({ email: knownEmail }: { email?: string }) {
  const t = useTranslations("AccountLinks");
  const [email, setEmail] = useState(knownEmail ?? "");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setState("sending");
    const result = await resendVerification(email);
    if (result.ok) {
      setState("sent");
    } else {
      setError(result.error);
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg bg-success-soft px-4 py-2.5 text-left text-sm text-success">
        <MailCheck size={16} className="mt-0.5 shrink-0" />
        {t("resendSent")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      {!knownEmail && (
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">{t("emailLabel")}</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-12 w-full rounded-lg border border-border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="flex h-11 w-full items-center justify-center rounded-lg border border-border bg-surface text-sm font-semibold text-ink transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "sending" ? t("sending") : t("resendButton")}
      </button>
    </form>
  );
}
