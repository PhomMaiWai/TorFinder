import { jsonResponse } from "@/lib/json-response";
import { relayPasskey } from "@/lib/passkey-relay";

/** The challenge for a step-up passkey check (ASVS 7.5.3). */
export async function POST() {
  const result = await relayPasskey("/auth/step-up/options");
  return result.ok ? jsonResponse(result.data) : result.response;
}
