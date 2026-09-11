import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** The backend responds 204 to both — nothing to parse as JSON either way. */
async function proxy(method: "POST" | "DELETE", torId: string) {
  const res = await fetch(`${BACKEND_URL}/api/saved-tors/${torId}`, {
    method,
    headers: await authHeaders(),
    cache: "no-store",
  });

  if (res.status === 204) return new NextResponse(null, { status: 204 });

  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

export async function POST(_request: Request, { params }: { params: Promise<{ torId: string }> }) {
  const { torId } = await params;
  return proxy("POST", torId);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ torId: string }> }) {
  const { torId } = await params;
  return proxy("DELETE", torId);
}
