/**
 * What an admin server action reports back. Server actions can't carry an
 * error's message to the browser in production (Next.js replaces it), so a
 * refusal is returned, not thrown. `stepUp` means the backend wants a fresh
 * passkey check first (ASVS 7.5.3); the client asks for one and retries
 * (`withStepUp` in passkeys-client.ts).
 */
export type ActionResult = {
  error?: string;
  stepUp?: boolean;
  /** Accepted, not applied: it waits for a second admin's approval (ASVS 2.3.5). */
  pending?: boolean;
};

/** Reads a backend answer into an ActionResult, keeping the backend's own message. */
export async function actionResultFrom(res: Response, fallback: string): Promise<ActionResult> {
  if (res.status === 202) return { pending: true };
  if (res.ok) return {};
  const body = (await res.json().catch(() => null)) as { message?: string | string[]; code?: string } | null;
  const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
  return { error: message ?? fallback, ...(body?.code === "step-up-required" && { stepUp: true }) };
}
