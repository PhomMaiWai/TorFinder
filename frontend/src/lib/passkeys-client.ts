import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

/**
 * Browser side of staff passkeys (backend auth/passkeys.service.ts): the
 * device makes or uses the key, these post its answer to our routes. Results
 * carry a reason a component can translate, or the server's own message.
 */

export type PasskeyFailure = "cancelled" | "unsupported" | "already-registered" | "failed";
export type PasskeyFailureResult = { ok: false; reason: PasskeyFailure; message?: string; code?: string };
export type PasskeyResult<T = undefined> = { ok: true; data: T } | PasskeyFailureResult;

export type PasskeyInfo = { id: string; name: string; createdAt: string; lastUsedAt?: string };

export const passkeysSupported = () => typeof window !== "undefined" && browserSupportsWebAuthn();

/** The browser's own errors: the user closed the prompt, or the key is already on this account. */
function fromBrowserError(error: unknown): PasskeyFailureResult {
  const name = (error as { name?: string })?.name;
  const code = (error as { code?: string })?.code;
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return { ok: false, reason: "already-registered" };
  if (name === "NotAllowedError" || name === "AbortError" || code === "ERROR_CEREMONY_ABORTED") {
    return { ok: false, reason: "cancelled" };
  }
  return { ok: false, reason: "failed" };
}

async function post<T>(path: string, body?: unknown): Promise<PasskeyResult<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, reason: "failed", message: data?.error, code: data?.code };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Step two of a staff sign-in, with the options /api/auth/login (or /api/auth/google) returned. */
export async function signInWithPasskey(options: PublicKeyCredentialRequestOptionsJSON): Promise<PasskeyResult> {
  if (!passkeysSupported()) return { ok: false, reason: "unsupported" };
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options });
  } catch (error) {
    return fromBrowserError(error);
  }
  const result = await post("/api/auth/passkey/login", { response });
  return result.ok ? { ok: true, data: undefined } : result;
}

/** A fresh passkey check before a sensitive action (ASVS 7.5.3). */
export async function stepUp(): Promise<PasskeyResult> {
  if (!passkeysSupported()) return { ok: false, reason: "unsupported" };
  const options = await post<PublicKeyCredentialRequestOptionsJSON>("/api/auth/step-up/options");
  if (!options.ok) return options;
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options.data });
  } catch (error) {
    return fromBrowserError(error);
  }
  const result = await post("/api/auth/step-up", { response });
  return result.ok ? { ok: true, data: undefined } : result;
}

/** Makes a passkey on this device and saves it. A second one needs step-up first (code "step-up-required"). */
export async function addPasskey(name: string): Promise<PasskeyResult<PasskeyInfo[]>> {
  if (!passkeysSupported()) return { ok: false, reason: "unsupported" };
  const options = await post<PublicKeyCredentialCreationOptionsJSON>("/api/auth/passkeys/options");
  if (!options.ok) return options;
  let response;
  try {
    response = await startRegistration({ optionsJSON: options.data });
  } catch (error) {
    return fromBrowserError(error);
  }
  const saved = await post<{ passkeys: PasskeyInfo[] }>("/api/auth/passkeys", { name, response });
  return saved.ok ? { ok: true, data: saved.data.passkeys } : saved;
}

export async function listPasskeys(): Promise<PasskeyInfo[] | null> {
  try {
    const res = await fetch("/api/auth/passkeys", { cache: "no-store" });
    return res.ok ? ((await res.json()) as PasskeyInfo[]) : null;
  } catch {
    return null;
  }
}

export async function removePasskey(id: string): Promise<PasskeyResult<PasskeyInfo[]>> {
  try {
    const res = await fetch(`/api/auth/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, reason: "failed", message: data?.error, code: data?.code };
    return { ok: true, data: data as PasskeyInfo[] };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/**
 * Runs an action; if the server answers that it needs a fresh passkey check,
 * asks for one and runs it once more. For server actions that return
 * `{ stepUp: true }` (and API calls that return code "step-up-required").
 */
export async function withStepUp<T extends { stepUp?: boolean; error?: string }>(
  action: () => Promise<T>,
  failureMessage: (result: PasskeyFailureResult) => string,
): Promise<T> {
  const first = await action();
  if (!first.stepUp) return first;
  const verified = await stepUp();
  if (!verified.ok) return { ...first, error: failureMessage(verified) };
  return action();
}
