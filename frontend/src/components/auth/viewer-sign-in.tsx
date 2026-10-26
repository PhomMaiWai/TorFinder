"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { GoogleSignInButton, isGoogleSignInEnabled } from "@/components/auth/google-sign-in-button";
import { homeFor } from "@/lib/roles";
import { resetSession } from "@/lib/use-session";

/** Back to the page that sent them to sign in — same-origin paths only, never an open redirect. */
function nextPath(fallback: string): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Google is the only way in for the public: it vouches for who they are and
 * the account exists from then on, with no company form and no approval wait.
 */
export function ViewerSignIn() {
  const t = useTranslations("ViewerSignIn");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-8 flex justify-center">
        {isGoogleSignInEnabled ? (
          <GoogleSignInButton
            as="viewer"
            onError={setError}
            onSuccess={(user) => {
              resetSession();
              router.replace(nextPath(homeFor(user.role)));
              router.refresh();
            }}
            // Only an existing company account can come back pending or incomplete.
            onPending={(companyName) => setError(t("pending", { companyName }))}
            onNeedsCompanyInfo={() => setError(t("useOrgLogin"))}
          />
        ) : (
          // Same face as Google's button, so the page reads finished before a
          // client ID is configured; pressing it says what is missing.
          <button
            type="button"
            onClick={() => setError(t("googleUnavailable"))}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface text-base font-semibold text-ink transition-colors hover:bg-surface-alt"
          >
            <GoogleLogo />
            {t("googleButton")}
          </button>
        )}
      </div>
    </>
  );
}
