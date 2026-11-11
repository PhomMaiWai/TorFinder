import type { SimilarHit } from "@/lib/similar-actions";
import type { TorRecord } from "@/types/tor";

export type RankedTor = { tor: TorRecord; hit: SimilarHit };

/**
 * The TORs the reader's filters left, in the order "find similar" ranked them.
 * One card per project: e-GP publishes a plan, a draft, an invitation and an
 * award for the same work, and four cards of one project would push every
 * other similar project off the page. The first one the filters kept stands for
 * it — the best-ranked, which is the one the reader can act on when the status
 * filter asks for open ones.
 */
export function rankBySimilarity(tors: TorRecord[], hits: SimilarHit[]): RankedTor[] {
  const byId = new Map(tors.map((tor) => [tor.id, tor]));
  const seenProjects = new Set<string>();
  const ranked: RankedTor[] = [];
  for (const hit of hits) {
    const tor = byId.get(hit.id);
    if (!tor) continue;
    if (tor.projectNumber) {
      if (seenProjects.has(tor.projectNumber)) continue;
      seenProjects.add(tor.projectNumber);
    }
    ranked.push({ tor, hit });
  }
  return ranked;
}
