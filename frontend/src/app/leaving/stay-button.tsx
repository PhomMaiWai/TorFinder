"use client";

import { useRouter } from "next/navigation";

/**
 * Back to where the link was. A link that opened this page in a new tab
 * leaves no history to go back to, so that tab is closed instead (browsers
 * allow it for a tab with a single page); failing both, home.
 */
export function StayButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        window.close();
        // Still open: the browser refused to close it.
        setTimeout(() => router.push("/"), 150);
      }}
      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
    >
      {label}
    </button>
  );
}
