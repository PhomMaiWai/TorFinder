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
export function getAllTors(): Promise<TorRecord[]> {
  // Every visit to the search page reads the whole set; one read serves them
  // all for a short while. A failed read is dropped at once, not cached.
  if (!listing || Date.now() - listing.at > LISTING_TTL_MS) {
    const read = readAllTors();
    listing = { at: Date.now(), read };
    read.catch(() => {
      if (listing?.read === read) listing = null;
    });
  }
  return listing.read;
}

/** Long enough to absorb a burst of visits, short enough that an import or an admin edit shows up soon. */
const LISTING_TTL_MS = 30_000;

/** Pages requested at once after the first; the backend answers each in ~0.1–0.2s. */
const PAGE_CONCURRENCY = 4;

let listing: { at: number; read: Promise<TorRecord[]> } | null = null;

async function readAllTors(): Promise<TorRecord[]> {
  const all = await fetchTorList(1, PAGE_SIZE);
  if (all.length < PAGE_SIZE) return all;

  // The total isn't known up front, so pages go out a few at a time until one
  // comes back short — three round trips for ~700 records instead of seven.
  for (let first = 2; first <= MAX_PAGES; first += PAGE_CONCURRENCY) {
    const pages = Array.from(
      { length: Math.min(PAGE_CONCURRENCY, MAX_PAGES - first + 1) },
      (_, i) => first + i,
    );
    const batches = await Promise.all(pages.map((page) => fetchTorList(page, PAGE_SIZE)));
    for (const batch of batches) all.push(...batch);
    if (batches.some((batch) => batch.length < PAGE_SIZE)) break;
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
