/** Limits and sizes for "find similar" (FR-13 follow-up, issue #255). */
export const SIMILAR = {
  /** A pasted project or profile; a whole proposal is more than the ranking needs. */
  minQueryChars: 10,
  maxQueryChars: 5_000,
  defaultLimit: 50,
  maxLimit: 100,
  /** Shared words shown with each result — enough to say why, few enough to read. */
  maxSharedTerms: 5,
  /**
   * What of each TOR is embedded. The title and the scope say what the work
   * is; past this the text is mostly boilerplate, and Thai costs the model
   * about one token per two characters.
   */
  embedTextChars: 1_200,
  /** Texts per embedding request: well inside the model's per-request token cap at the size above. */
  embedBatchSize: 10,
  /** Requests in flight while backfilling. */
  embedConcurrency: 3,
  /**
   * Missing vectors a search will wait for. A first search on a fresh database
   * would otherwise wait for the whole collection; past this it answers by
   * keywords and the backfill finishes in the background.
   */
  inlineBackfillMax: 60,
  /** A keyword result sharing no meaningful word with the query is not a result. */
  minKeywordScore: 0.02,
} as const;

export type SimilarMethod = "ai" | "keyword";
