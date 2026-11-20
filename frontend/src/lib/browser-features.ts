/**
 * The browser security features TorFinder relies on that a page can actually
 * test for (the full list is in docs/security/asvs-l3.md, "Required browser
 * features"). A missing one means the browser predates them.
 */
export function missingSecurityFeatures(win: typeof globalThis): string[] {
  const missing: string[] = [];
  // Content-Security-Policy Level 3 browsers expose violation events.
  if (typeof (win as { SecurityPolicyViolationEvent?: unknown }).SecurityPolicyViolationEvent === "undefined") missing.push("csp");
  // Web Crypto only exists in a secure context, so it also catches a page not served over HTTPS.
  if (!(win as { crypto?: Crypto }).crypto?.subtle) missing.push("secure-context");
  // Browsers that honour Cross-Origin-Opener-Policy expose crossOriginIsolated.
  if (!("crossOriginIsolated" in win)) missing.push("cross-origin-isolation");
  return missing;
}
