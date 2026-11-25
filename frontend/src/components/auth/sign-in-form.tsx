"use client";

import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { ArrowLeft, Building2, KeyRound, ShieldAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

import { GoogleCompleteSignupForm } from "@/components/auth/google-complete-signup-form";
import { GoogleSignInButton, isGoogleSignInEnabled } from "@/components/auth/google-sign-in-button";
import { ResendVerification } from "@/components/auth/resend-verification";
import { PasswordInput } from "@/components/ui/password-input";
import { type PasskeyFailureResult, signInWithPasskey } from "@/lib/passkeys-client";
import { resetSession } from "@/lib/use-session";

const ICONS = {
  building: Building2,
  shield: ShieldAlert,
} as const satisfies Record<string, LucideIcon>;

type SignInIcon = keyof typeof ICONS;

type SignInFormProps = {
  icon: SignInIcon;
  badge: string;
  title: string;
  description: string;
  redirectTo: string;
  switchHref: string;
  switchLabel: string;
  signupHref?: string;
  signupLabel?: string;
  tone?: "accent" | "danger";
  /** Google sign-in always creates an "org" account — hide it where that's wrong (e.g. admin login). */
  allowGoogleSignIn?: boolean;
};

export function SignInForm({
  icon,
  badge,
  title,
  description,
  redirectTo,
  switchHref,
  switchLabel,
  signupHref,
  signupLabel,
  tone = "accent",
  allowGoogleSignIn = true,
}: SignInFormProps) {
  const t = useTranslations("SignInForm");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const tp = useTranslations("Passkeys");
  const router = useRouter();
  const Icon = ICONS[icon];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Set when the password was right but the address is still unconfirmed. */
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleSignup, setGoogleSignup] = useState<{ credential: string; email: string } | null>(
    null,
  );
  /** Set once the first factor passed for a staff account with a passkey (ASVS 6.3.3). */
  const [passkeyOptions, setPasskeyOptions] = useState<PublicKeyCredentialRequestOptionsJSON | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  function passkeyMessage(result: PasskeyFailureResult): string {
    if (result.message) return result.message;
    if (result.reason === "cancelled") return tp("cancelled");
    if (result.reason === "unsupported") return tp("unsupported");
    return tp("failed");
  }

  /** Step two: the device signs the challenge, and the session cookie is set. */
  async function completeWithPasskey(options: PublicKeyCredentialRequestOptionsJSON) {
    setError(null);
    setPasskeyOptions(options);
    setPasskeyBusy(true);
    const result = await signInWithPasskey(options);
    setPasskeyBusy(false);
    if (!result.ok) {
      setError(passkeyMessage(result));
      // A spent or expired challenge can't be retried; the password step starts over.
      if (result.message) setPasskeyOptions(null);
      return;
    }
    resetSession();
    router.push(redirectTo);
    router.refresh();
  }

  const badgeCls =
    tone === "danger" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-text";
  const buttonCls =
    tone === "danger"
      ? "bg-danger hover:bg-danger/90"
      : "bg-accent hover:bg-accent-dark";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setUnverifiedEmail(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? te("loginFailed"));
        if (data.code === "email-unverified") setUnverifiedEmail(email);
        return;
      }

      if (data.status === "passkey-required") {
        setPassword("");
        await completeWithPasskey(data.options);
        return;
      }

      resetSession();
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError(te("connectionFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoogleSuccess() {
    setError(null);
    resetSession();
    router.push(redirectTo);
    router.refresh();
  }

  function handleGooglePending(companyName: string) {
    setError(null);
    router.push(`/signup/pending?name=${encodeURIComponent(companyName)}`);
  }

  function handleGoogleNeedsCompanyInfo(info: { credential: string; email: string }) {
    setError(null);
    setGoogleSignup(info);
  }

  function handleGoogleCompanySubmitted(companyName: string) {
    router.push(`/signup/pending?name=${encodeURIComponent(companyName)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt px-6 py-12">
      <div className={`w-full ${googleSignup ? "max-w-2xl" : "max-w-lg"}`}>
        <Link href="/" className="mb-10 flex items-center justify-center gap-2.5">
          <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-base font-bold text-white">
            T
          </span>
          <span className="text-xl font-bold tracking-tight text-ink">TorFinder</span>
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-10">
          {passkeyOptions ? (
            <div>
              <span
                className={`mb-4 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${badgeCls}`}
              >
                <KeyRound size={15} />
                {badge}
              </span>
              <h1 className="text-2xl font-bold text-ink">{tp("signInTitle")}</h1>
              <p className="mt-1.5 text-base text-ink-muted">{tp("signInDescription")}</p>
              {error && (
                <p role="alert" className="mt-5 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger">
                  {error}
                </p>
              )}
              <button
                type="button"
                disabled={passkeyBusy}
                onClick={() => completeWithPasskey(passkeyOptions)}
                className={`mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-lg text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${buttonCls}`}
              >
                <KeyRound size={18} />
                {passkeyBusy ? tp("waiting") : tp("signInButton")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasskeyOptions(null);
                  setError(null);
                }}
                className="mt-4 w-full text-center text-sm font-medium text-ink-muted hover:text-ink"
              >
                {tp("backToPassword")}
              </button>
            </div>
          ) : googleSignup ? (
            <GoogleCompleteSignupForm
              credential={googleSignup.credential}
              email={googleSignup.email}
              onSubmitted={handleGoogleCompanySubmitted}
              onCancel={() => setGoogleSignup(null)}
            />
          ) : (
            <>
              <span
                className={`mb-4 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${badgeCls}`}
              >
                <Icon size={15} />
                {badge}
              </span>
              <h1 className="text-2xl font-bold text-ink">{title}</h1>
              <p className="mt-1.5 text-base text-ink-muted">{description}</p>

              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger"
                >
                  {error}
                </p>
              )}
              {unverifiedEmail && (
                <div className="mt-3">
                  <ResendVerification key={unverifiedEmail} email={unverifiedEmail} />
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                <label className="block">
                  <span className="mb-2 flex items-center justify-between text-sm font-medium text-ink">
                    {t("passwordLabel")}
                    <Link href="/forgot-password" className="font-medium text-accent hover:text-accent-dark">
                      {t("forgotPassword")}
                    </Link>
                  </span>
                  <PasswordInput
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    showLabel={tc("showPassword")}
                    hideLabel={tc("hidePassword")}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex h-12 w-full items-center justify-center rounded-lg text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${buttonCls}`}
                >
                  {isSubmitting ? t("submitting") : t("submitLabel")}
                </button>
              </form>

              {allowGoogleSignIn && isGoogleSignInEnabled && (
                <>
                  <div className="mt-6 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium text-ink-subtle">{tc("orDivider")}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <div className="mt-6 flex justify-center">
                    <GoogleSignInButton
                      onError={setError}
                      onSuccess={handleGoogleSuccess}
                      onPending={handleGooglePending}
                      onNeedsCompanyInfo={handleGoogleNeedsCompanyInfo}
                      onPasskeyRequired={completeWithPasskey}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {!googleSignup && signupHref && signupLabel && (
          <p className="mt-6 text-center text-sm text-ink-muted">
            {t("noAccountQuestion")}{" "}
            <Link href={signupHref} className="font-medium text-accent hover:text-accent-dark">
              {signupLabel}
            </Link>
          </p>
        )}

        {!googleSignup && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link href="/login" className="font-medium text-ink-muted hover:text-ink">
              {t("chooseOtherAccountType")}
            </Link>
            <Link href={switchHref} className="font-medium text-accent hover:text-accent-dark">
              {switchLabel}
            </Link>
          </div>
        )}

        <Link
          href="/"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} />
          {tc("backToHome")}
        </Link>
      </div>
    </main>
  );
}
