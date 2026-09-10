"use client";

import Script from "next/script";
import { useRef } from "react";

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
          renderButton: (parent: HTMLElement, options: { width: number }) => void;
        };
      };
    };
  }
}

type GoogleSignInButtonProps = {
  onError: (message: string) => void;
  onSuccess: () => void;
  /** A brand-new (or newly-linked) account that still needs admin approval. */
  onPending: (companyName: string) => void;
  /** A Google identity we've never seen, with no account to link to — needs a company profile before it can go pending. */
  onNeedsCompanyInfo: (info: { credential: string; email: string; name: string }) => void;
};

export function GoogleSignInButton({
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
        body: JSON.stringify({ credential: response.credential }),
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
      onSuccess();
    } catch {
      onError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  // `onReady` (unlike `onLoad`) fires on every mount, not just the first
  // script load — so navigating back to a login page re-renders the button
  // even though the <script> tag itself is only fetched once.
  function handleScriptReady() {
    if (!window.google || !buttonRef.current) return;
    window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential });
    window.google.accounts.id.renderButton(buttonRef.current, { width: 400 });
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
