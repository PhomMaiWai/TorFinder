import { jsonResponse } from "@/lib/json-response";
import { relayPasskey, withSession } from "@/lib/passkey-relay";

/** Step two of a staff sign-in: the passkey's answer to the challenge /api/auth/login returned. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await relayPasskey("/auth/passkey/login", { body: { response: body?.response } });
  if (!result.ok) return result.response;
  return withSession(jsonResponse({ user: result.data?.user }), result.data?.token);
}
