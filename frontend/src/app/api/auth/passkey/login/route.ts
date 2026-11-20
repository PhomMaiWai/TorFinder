import { clientDevice, rememberDevice } from "@/lib/device-cookie";
import { jsonResponse } from "@/lib/json-response";
import { relayPasskey, withSession } from "@/lib/passkey-relay";

/** Step two of a staff sign-in: the passkey's answer to the challenge /api/auth/login returned. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const device = await clientDevice();
  const result = await relayPasskey("/auth/passkey/login", { body: { response: body?.response }, headers: device.headers });
  if (!result.ok) return result.response;
  return withSession(rememberDevice(jsonResponse({ user: result.data?.user }), device), result.data?.token);
}
