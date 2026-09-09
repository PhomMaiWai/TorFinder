import { OPPORTUNITIES } from "@/data/opportunities";
import { fetchTor, fetchTorList } from "@/lib/tor-api";
import type { Opportunity } from "@/types/opportunity";
import type { TorRecord } from "@/types/tor";

/** The list endpoint caps a page at 100. */
const PAGE_SIZE = 100;

/** Enough for the whole Bangkok e-GP import; a guard against looping forever. */
const MAX_PAGES = 50;

/**
 * Records still held in `data/opportunities.ts`. The public pages read the
 * database now; these only remain so links from the pages that haven't been
 * migrated yet (dashboard, owner, landing preview) still resolve.
 */
const MOCK_PREFIX = "mock-";

function toRecord(opportunity: Opportunity): TorRecord {
  const { id, ...rest } = opportunity;
  return { ...rest, id: `${MOCK_PREFIX}${id}`, createdAt: "" };
}

const MOCK_TORS: TorRecord[] = OPPORTUNITIES.map(toRecord);

/**
 * The showcase record an id points at, or null for a real one. The prefix is
 * required: a database id is 24 hex characters, which can legitimately be all
 * digits, and treating one of those as a showcase record would paste
 * hand-written scope and feedback onto a genuine announcement.
 */
export function mockNumericId(id: string): number | null {
  if (!id.startsWith(MOCK_PREFIX)) return null;
  const raw = id.slice(MOCK_PREFIX.length);
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

/**
 * Everything in the database — announcements imported from e-GP included. The
 * search page filters and counts client-side, so it needs the whole set, not
 * just the first page the endpoint will hand out.
 */
export async function getAllTors(): Promise<TorRecord[]> {
  const all: TorRecord[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchTorList(page, PAGE_SIZE);
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return all;
}

export async function getTorById(id: string): Promise<TorRecord | null> {
  const numericId = mockNumericId(id);
  if (numericId !== null) {
    return MOCK_TORS.find((tor) => tor.id === `${MOCK_PREFIX}${numericId}`) ?? null;
  }
  return fetchTor(id);
}
