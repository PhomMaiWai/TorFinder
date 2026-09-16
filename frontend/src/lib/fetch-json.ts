/**
 * Every read from the backend goes through here, so a page can tell the two
 * failures apart: "the backend said there is no such thing" and "the backend
 * couldn't answer". They look identical to a `fetch` caller and mean opposite
 * things to a reader — one is an empty result, the other is a broken page with
 * a retry button.
 */

/** Requests that outlive this are treated as the backend being unavailable. */
const DEFAULT_TIMEOUT_MS = 10_000;

export class BackendError extends Error {
  constructor(
    /** The HTTP status, or null when the request never got an answer at all. */
    readonly status: number | null,
    readonly path: string,
  ) {
    super(`${path} → ${status ?? "no response"}`);
    this.name = "BackendError";
  }

  /** 404 and 403 are answers; anything else means the backend is in trouble. */
  get isAnswer(): boolean {
    return this.status === 404 || this.status === 403;
  }
}

type Options = {
  headers?: HeadersInit;
  timeoutMs?: number;
};

export async function fetchJson<T>(path: string, options: Options = {}): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${process.env.BACKEND_URL}${path}`, {
      headers: options.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    // Refused, DNS, timeout — no status to reason about, and nothing a reader
    // can do except try again.
    throw new BackendError(null, path);
  }

  if (!res.ok) throw new BackendError(res.status, path);
  return res.json() as Promise<T>;
}

/**
 * For a panel the page can do without — a budget verdict, a comment count. The
 * page still renders; the panel just isn't there. Used deliberately at the call
 * site rather than hidden inside the fetch, so "this failure is survivable" is
 * a decision someone made and not the default for everything.
 */
export async function orFallback<T>(read: Promise<T>, fallback: T): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[optional read failed]", error);
    }
    return fallback;
  }
}

/**
 * For a read whose "no" is a real answer: a missing announcement, a listing an
 * account isn't allowed to see. Anything else still throws, so a backend that
 * is down never masquerades as an empty page.
 */
export async function orEmptyWhenAnswered<T>(read: Promise<T>, fallback: T): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof BackendError && error.isAnswer) return fallback;
    throw error;
  }
}
