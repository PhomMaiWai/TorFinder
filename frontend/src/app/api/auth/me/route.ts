import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { jsonResponse } from "@/lib/json-response";

export async function GET() {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);

  if (!session) {
    return jsonResponse({ user: null }, { status: 401 });
  }

  return jsonResponse({
    user: { id: session.sub, email: session.email, name: session.name, role: session.role },
  });
}
