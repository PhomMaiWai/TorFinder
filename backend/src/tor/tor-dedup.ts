/**
 * Titles arrive from two unrelated sources — an admin's free-text form and
 * e-GP's own wording — so they're rarely byte-identical even for the same
 * real project. This does the best a plain heuristic can: exact match after
 * normalizing punctuation/whitespace, one title containing the other (e-GP
 * often appends a clause an admin wouldn't type), or high word overlap for
 * titles that share most of their words in a different order.
 */

/** Trims, collapses whitespace, and drops punctuation that carries no meaning for matching. */
export function normalizeForMatch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,()\-–—"'“”‘’]/g, " ")
    .replace(/\s+/g, " ");
}

const MIN_CONTAINMENT_LENGTH = 10;
const WORD_OVERLAP_THRESHOLD = 0.7;

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter(Boolean));
  const wordsB = new Set(b.split(" ").filter(Boolean));
  if (wordsA.size < 2 || wordsB.size < 2) return 0;

  const intersection = [...wordsA].filter((word) => wordsB.has(word)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

/** True if two titles most likely describe the same real-world project. */
export function isLikelyDuplicateTitle(titleA: string, titleB: string): boolean {
  const a = normalizeForMatch(titleA);
  const b = normalizeForMatch(titleB);
  if (!a || !b) return false;

  if (a === b) return true;

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length >= MIN_CONTAINMENT_LENGTH && longer.includes(shorter)) return true;

  return wordOverlap(a, b) >= WORD_OVERLAP_THRESHOLD;
}

/**
 * e-GP's agency field combines group and department ("กรม... · กอง...");
 * an admin picks a plain name from a short list. Containment catches the
 * common case without requiring the two sources to agree on formatting.
 */
export function isLikelySameAgency(agencyA: string, agencyB: string): boolean {
  const a = normalizeForMatch(agencyA);
  const b = normalizeForMatch(agencyB);
  if (!a || !b) return false;

  return a === b || a.includes(b) || b.includes(a);
}
