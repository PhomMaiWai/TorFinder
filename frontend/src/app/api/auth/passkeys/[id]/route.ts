import { jsonResponse } from "@/lib/json-response";
import { relayPasskey } from "@/lib/passkey-relay";

/** A credential id is base64url; anything else can't be one, so the backend isn't asked. */
const CREDENTIAL_ID = /^[A-Za-z0-9_-]{16,1024}$/;

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CREDENTIAL_ID.test(id)) return jsonResponse({ error: "Not found" }, { status: 404 });
  const result = await relayPasskey(`/auth/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" });
  return result.ok ? jsonResponse(result.data) : result.response;
}
