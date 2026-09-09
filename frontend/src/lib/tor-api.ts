import type { TorRecord } from "@/types/tor";

/** `source` omitted lists both admin-entered and e-GP records. */
export async function fetchTorList(
  page = 1,
  pageSize = 20,
  source?: "manual" | "egp",
): Promise<TorRecord[]> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (source) query.set("source", source);

  const res = await fetch(`${process.env.BACKEND_URL}/api/tor?${query}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchTor(id: string): Promise<TorRecord | null> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}
