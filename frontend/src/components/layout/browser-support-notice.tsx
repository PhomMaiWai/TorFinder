"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { missingSecurityFeatures } from "@/lib/browser-features";

/** The feature set doesn't change while the page is open, so there is nothing to subscribe to. */
const noSubscription = () => () => {};

/**
 * ASVS 3.7.5: in a browser without the security features the site depends
 * on, the documented behaviour is to warn, not to block. The site still
 * works, and every server-side check still applies, but the reader is told
 * which protections their browser doesn't give them and to update it.
 */
export function BrowserSupportNotice() {
  const t = useTranslations("BrowserSupport");
  // Checked in the browser only; the server render shows nothing, so the
  // first paint matches and only an unsupported browser sees the warning.
  const missing = useSyncExternalStore(
    noSubscription,
    () => missingSecurityFeatures(globalThis).join(","),
    () => "",
  );

  if (!missing) return null;
  return (
    <div role="alert" className="bg-warn-soft px-4 py-2 text-center text-sm font-medium text-ink">
      {t("warning")}
    </div>
  );
}
