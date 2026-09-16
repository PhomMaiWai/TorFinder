import { isLikelyDuplicateTitle, isLikelySameAgency, normalizeForMatch } from "./tor-dedup";

/** The least a stored record has to expose to be matched against. */
export type DedupEntry = { title: string; agency: string };

/**
 * Characters per shingle, and how far apart the stored ones are taken. A run of
 * text shared by two titles is guaranteed to contain a stored shingle once it
 * reaches SHINGLE + STRIDE - 1 characters, which is where the comparison
 * heuristic starts finding duplicates anyway (see MIN_CONTAINMENT_LENGTH).
 */
const SHINGLE = 10;
const STRIDE = 5;

function shingles(text: string, stride: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + SHINGLE <= text.length; i += stride) out.push(text.slice(i, i + SHINGLE));
  return out;
}

/**
 * Finds the stored record that most likely describes the same real project as
 * an incoming one.
 *
 * Comparing every incoming record against every stored one was affordable when
 * a handful of admin entries were the only thing to check; with three portals
 * filling the collection it is tens of millions of string comparisons per sync.
 * So titles are indexed by fixed-length character runs, and only the records
 * that share one are ever compared in full.
 *
 * What that trades away: two titles whose longest shared run is under
 * SHINGLE + STRIDE - 1 characters are never compared, so a pair that only
 * word-overlap would have matched can slip through. Thai titles are written
 * without spaces — one long token, no word overlap to speak of — so in practice
 * that only ever applied to the English fragments inside them.
 */
export class TorDedupIndex<T extends DedupEntry> {
  /** Exact normalized title → entries, the common case answered without scanning. */
  private readonly byTitle = new Map<string, number[]>();
  private readonly byShingle = new Map<string, number[]>();
  private readonly normalized: string[];

  constructor(private readonly entries: readonly T[]) {
    this.normalized = entries.map((entry) => normalizeForMatch(entry.title));

    this.normalized.forEach((title, index) => {
      if (!title) return;
      push(this.byTitle, title, index);
      for (const shingle of shingles(title, STRIDE)) push(this.byShingle, shingle, index);
    });
  }

  find(title: string, agency: string): T | null {
    const normalized = normalizeForMatch(title);
    if (!normalized) return null;

    const exact = this.firstMatching(this.byTitle.get(normalized), agency);
    if (exact) return exact;

    // Every position on the query side, every STRIDE-th on the stored side:
    // between them, any shared run long enough to matter lands on a shingle
    // both of them hold.
    const candidates = new Set<number>();
    for (const shingle of shingles(normalized, 1)) {
      for (const index of this.byShingle.get(shingle) ?? []) candidates.add(index);
    }

    for (const index of candidates) {
      if (
        isLikelyDuplicateTitle(this.entries[index].title, title) &&
        isLikelySameAgency(this.entries[index].agency, agency)
      ) {
        return this.entries[index];
      }
    }
    return null;
  }

  private firstMatching(indexes: number[] | undefined, agency: string): T | null {
    for (const index of indexes ?? []) {
      if (isLikelySameAgency(this.entries[index].agency, agency)) return this.entries[index];
    }
    return null;
  }
}

function push(map: Map<string, number[]>, key: string, index: number): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(index);
  else map.set(key, [index]);
}
