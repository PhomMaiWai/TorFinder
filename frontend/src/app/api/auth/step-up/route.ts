import { jsonResponse } from "@/lib/json-response";
import { relayPasskey, withSession } from "@/lib/passkey-relay";

/** The step-up answer; the session comes back re-signed with the check's time. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await relayPasskey("/auth/step-up", { body: { response: body?.response } });
  if (!result.ok) return result.response;
  return withSession(jsonResponse({ ok: true }), result.data?.token);
}
