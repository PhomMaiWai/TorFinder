import { jsonResponse } from "@/lib/json-response";
import { relayPasskey, withSession } from "@/lib/passkey-relay";

/** The signed-in staff member's passkeys. */
export async function GET() {
  const result = await relayPasskey("/auth/passkeys", { method: "GET" });
  return result.ok ? jsonResponse(result.data) : result.response;
}

/** Saves a new passkey; the session comes back re-signed as passkey-verified. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await relayPasskey("/auth/passkeys", { body: { name: body?.name, response: body?.response } });
  if (!result.ok) return result.response;
  return withSession(jsonResponse({ passkeys: result.data?.passkeys }), result.data?.token);
}
