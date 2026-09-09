import { OPPORTUNITIES } from "@/data/opportunities";
import { fetchTor, fetchTorList } from "@/lib/tor-api";
import type { Opportunity } from "@/types/opportunity";
import type { TorRecord } from "@/types/tor";

/**
 * The public pages show the seeded showcase records alongside whatever admins
 * created or imported, so mock ids are namespaced to never collide with an
 * ObjectId. Bare numeric ids still resolve, since older links use those.
 */
const MOCK_PREFIX = "mock-";

function toRecord(opportunity: Opportunity): TorRecord {
  const { id, ...rest } = opportunity;
  return { ...rest, id: `${MOCK_PREFIX}${id}`, createdAt: "" };
}

export const MOCK_TORS: TorRecord[] = OPPORTUNITIES.map(toRecord);

export function mockNumericId(id: string): number | null {
  const raw = id.startsWith(MOCK_PREFIX) ? id.slice(MOCK_PREFIX.length) : id;
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

/** Showcase records plus what admins entered by hand — e-GP imports stay out. */
export async function getAllTors(): Promise<TorRecord[]> {
  const created = await fetchTorList(1, 100, "manual");
  return [...MOCK_TORS, ...created];
}

export async function getTorById(id: string): Promise<TorRecord | null> {
  const numericId = mockNumericId(id);
  if (numericId !== null) {
    return MOCK_TORS.find((tor) => tor.id === `${MOCK_PREFIX}${numericId}`) ?? null;
  }
  return fetchTor(id);
}
