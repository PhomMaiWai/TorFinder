"use client";

import Script from "next/script";
import { useRef } from "react";

import type { SessionUser } from "@/lib/use-session";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const isGoogleSignInEnabled = Boolean(CLIENT_ID);

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              width: number;
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "continue_with";
              shape?: "rectangular" | "pill";
              logo_alignment?: "left" | "center";
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

type CredentialHandler = (response: { credential: string }) => void;

/**
 * Google allows one initialize() per page load; calling it again on every
 * mount only replaces the last one (and logs a warning). So it runs once, and
 * its callback forwards to whichever button is mounted right now.
 */
let isInitialized = false;
let activeHandler: CredentialHandler | null = null;

type GoogleSignInButtonProps = {
  /** "viewer" signs an unknown identity straight in as a public viewer instead of asking for a company. */
  as?: "viewer";
  onError: (message: string) => void;
  onSuccess: (user: SessionUser) => void;
  /** A brand-new (or newly-linked) account that still needs admin approval. */
  onPending: (companyName: string) => void;
  /** A Google identity we've never seen, with no account to link to — needs a company profile before it can go pending. */
  onNeedsCompanyInfo: (info: { credential: string; email: string; name: string }) => void;
};

export function GoogleSignInButton({
  as,
  onError,
  onSuccess,
  onPending,
  onNeedsCompanyInfo,
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);

  if (!CLIENT_ID) return null;

  async function handleCredential(response: { credential: string }) {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential, as }),
      });
      const data = await res.json();

      if (!res.ok) {
        onError(data.error ?? "เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
        return;
      }
      if (data.status === "pending") {
        onPending(data.companyName ?? "บริษัทของคุณ");
        return;
      }
      if (data.status === "needs-company-info") {
        onNeedsCompanyInfo({
          credential: response.credential,
          email: data.email ?? "",
          name: data.name ?? "",
        });
        return;
      }
      onSuccess(data.user);
    } catch {
      onError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  // `onReady` (unlike `onLoad`) fires on every mount, not just the first
  // script load — so navigating back to a login page re-renders the button
  // even though the <script> tag itself is only fetched once.
  function handleScriptReady() {
    if (!window.google || !buttonRef.current) return;
    activeHandler = handleCredential;
    if (!isInitialized) {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => activeHandler?.(response),
      });
      isInitialized = true;
    }
    // Google caps the width at 400px; narrower screens get the space they have.
    const width = Math.min(400, buttonRef.current.parentElement?.clientWidth ?? 400);
    window.google.accounts.id.renderButton(buttonRef.current, {
      width,
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "center",
      locale: document.documentElement.lang || "th",
    });
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={handleScriptReady}
      />
      <div ref={buttonRef} />
    </>
  );
}
