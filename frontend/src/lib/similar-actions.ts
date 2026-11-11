"use server";

import { authHeaders } from "@/lib/session-headers";

/** One ranked TOR; the card itself comes from the list the search page already holds. */
export type SimilarHit = {
  id: string;
  /** 0-100, for comparing results of one search with each other. */
  similarity: number;
  sharedTerms: string[];
};

export type SimilarError = "tooShort" | "profileEmpty" | "notFound" | "rateLimited" | "failed";

export type SimilarAnswer =
  | {
      ok: true;
      /** "ai" when Vertex AI embeddings ranked them, "keyword" when shared words did. */
      method: "ai" | "keyword";
      basedOn: { id: string; title: string } | null;
      hits: SimilarHit[];
    }
  | { ok: false; error: SimilarError };

export type SimilarInput = { text: string } | { torId: string } | { fromProfile: true };

/** The backend's own cap; the search page filters what comes back, so it asks for all of it. */
const LIMIT = 100;
const MIN_CHARS = 10;
/** A first search on a fresh database may wait for a batch of embeddings. */
const TIMEOUT_MS = 30_000;

/**
 * The company's own words about itself, for "use my profile": past projects
 * first, then what it specialises in. Null when the account has neither.
 */
async function profileText(): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/accounts/me`, {
      headers: await authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const account = (await res.json()) as {
      company?: { pastExperience?: string; specialty?: string };
    };
    const text = [account.company?.pastExperience, account.company?.specialty]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join("\n");
    return text.length >= MIN_CHARS ? text : null;
  } catch {
    return null;
  }
}

/**
 * "Find similar" (issue #255): TORs ranked by how alike they are to a pasted
 * project, the company's profile, or one TOR. Public, like the search page;
 * only "use my profile" needs a session.
 */
export async function findSimilarTors(input: SimilarInput): Promise<SimilarAnswer> {
  let body: { text?: string; torId?: string; limit: number };
  if ("fromProfile" in input) {
    const text = await profileText();
    if (!text) return { ok: false, error: "profileEmpty" };
    body = { text: text.slice(0, 5_000), limit: LIMIT };
  } else if ("torId" in input) {
    body = { torId: input.torId, limit: LIMIT };
  } else {
    const text = input.text.trim();
    if (text.length < MIN_CHARS) return { ok: false, error: "tooShort" };
    body = { text: text.slice(0, 5_000), limit: LIMIT };
  }

  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/api/tor/similar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, error: "failed" };
  }

  if (!res.ok) {
    if (res.status === 429) return { ok: false, error: "rateLimited" };
    if (res.status === 404) return { ok: false, error: "notFound" };
    if (res.status === 400 && body.text !== undefined) return { ok: false, error: "tooShort" };
    return { ok: false, error: "failed" };
  }

  const data = (await res.json()) as {
    method: "ai" | "keyword";
    basedOn: { id: string; title: string } | null;
    results: SimilarHit[];
  };
  return {
    ok: true,
    method: data.method,
    basedOn: data.basedOn,
    hits: data.results.map(({ id, similarity, sharedTerms }) => ({ id, similarity, sharedTerms })),
  };
}
