import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/auth";

export type AccountStatus = "pending" | "approved" | "rejected";

export type OrgAccount = {
  id: string;
  email: string;
  name: string;
  status: AccountStatus;
  createdAt: string;
  reviewedAt?: string;
  company?: {
    companyName: string;
    taxId: string;
    contactName: string;
    phone: string;
    address: string;
    specialty: string;
    size: string;
    /** Skills/services the company offers — absent until it fills the profile in. */
    techStack?: string[];
    /** Free-text summary of past projects — absent until the company writes one. */
    pastExperience?: string;
  };
};

/** The backend guards these routes, so the caller's session travels with them. */
async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchAccounts(status?: AccountStatus): Promise<OrgAccount[]> {
  const query = status ? `?status=${status}` : "";
  const res = await fetch(`${process.env.BACKEND_URL}/api/accounts${query}`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function reviewAccount(id: string, status: Exclude<AccountStatus, "pending">) {
  const res = await fetch(`${process.env.BACKEND_URL}/api/accounts/${id}`, {
    method: "PATCH",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("อัปเดตสถานะบัญชีไม่สำเร็จ");
}
