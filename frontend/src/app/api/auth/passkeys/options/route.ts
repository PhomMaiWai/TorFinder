import { jsonResponse } from "@/lib/json-response";
import { relayPasskey } from "@/lib/passkey-relay";

/** The challenge for adding a passkey. */
export async function POST() {
  const result = await relayPasskey("/auth/passkeys/options");
  return result.ok ? jsonResponse(result.data) : result.response;
}
