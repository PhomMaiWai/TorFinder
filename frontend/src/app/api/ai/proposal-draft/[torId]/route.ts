import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** A long model answer — well past the usual request timeout. */
export const maxDuration = 180;

export async function POST(request: Request, { params }: { params: Promise<{ torId: string }> }) {
  const { torId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(`${BACKEND_URL}/api/ai/proposal-draft/${encodeURIComponent(torId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: await request.text(),
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
