import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { idPath, isObjectId } from "@/lib/backend-path";
import { jsonResponse } from "@/lib/json-response";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** The backend responds 204 to both — nothing to parse as JSON either way. */
async function proxy(method: "POST" | "DELETE", torId: string) {
  if (!isObjectId(torId)) return jsonResponse({ error: "ไม่พบรายการ TOR" }, { status: 404 });
  const res = await fetch(`${BACKEND_URL}/api/saved-tors/${idPath(torId)}`, {
    method,
    headers: await authHeaders(),
    cache: "no-store",
  });

  if (res.status === 204) return new NextResponse(null, { status: 204 });

  const data = await res.json().catch(() => null);
  return jsonResponse(data, { status: res.status });
}

export async function POST(_request: Request, { params }: { params: Promise<{ torId: string }> }) {
  const { torId } = await params;
  return proxy("POST", torId);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ torId: string }> }) {
  const { torId } = await params;
  return proxy("DELETE", torId);
}
