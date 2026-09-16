import { Logger } from "@nestjs/common";

/** Who the procurement portals see polling them — one project, one agent string. */
export const USER_AGENT = "TorFinder/1.0 (Kasetsart University project)";

/** 4xx other than 429 mean the request itself is wrong, so retrying can't help. */
export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`responded ${status}`);
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export type RequestOptions = {
  timeoutMs?: number;
  maxRetries?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A read-only client over one base URL: a timeout per attempt, and exponential
 * backoff on the failures worth retrying. Every portal this app imports from
 * rate-limits bursts from a single client the same way, so the policy lives
 * here instead of being written once per integration.
 *
 * Nothing here mutates anything at the far end — `postForm` exists because two
 * of the three portals expose their *search* over POST, not because a POST
 * means a write.
 */
export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaults: Required<RequestOptions>,
    private readonly logger: Logger,
    /** Headers every request to this portal needs — see each client for why. */
    private readonly defaultHeaders: Record<string, string> = {},
  ) {}

  get<T>(path: string, query: Record<string, string> = {}, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    return this.request(url, { accept: "application/json" }, options).then(
      (res) => res.json() as Promise<T>,
    );
  }

  postForm<T>(path: string, form: Record<string, string>, options: RequestOptions = {}): Promise<T> {
    return this.request(
      new URL(`${this.baseUrl}${path}`),
      {
        accept: "application/json",
        method: "POST",
        body: new URLSearchParams(form),
        // The portals' DataTables endpoints answer HTML to anything that
        // doesn't announce itself as their own page's XHR.
        extraHeaders: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
        },
      },
      options,
    ).then((res) => res.json() as Promise<T>);
  }

  /** For the pages that publish facts as HTML only — see each client's parser. */
  getText(path: string, options: RequestOptions = {}): Promise<string> {
    return this.request(new URL(`${this.baseUrl}${path}`), { accept: "text/html" }, options).then(
      (res) => res.text(),
    );
  }

  private async request(
    url: URL,
    init: {
      accept: string;
      method?: string;
      body?: URLSearchParams;
      extraHeaders?: Record<string, string>;
    },
    options: RequestOptions,
  ): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? this.defaults.timeoutMs;
    const maxRetries = options.maxRetries ?? this.defaults.maxRetries;

    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: init.method ?? "GET",
          body: init.body,
          headers: {
            "User-Agent": USER_AGENT,
            Accept: init.accept,
            ...this.defaultHeaders,
            ...init.extraHeaders,
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new HttpError(res.status);
        return res;
      } catch (error) {
        lastError = error;
        if (error instanceof HttpError && !error.retryable) break;
        if (attempt === maxRetries - 1) break;
        await sleep(2 ** attempt * 500);
      }
    }

    this.logger.warn(`request failed: ${url.pathname} — ${String(lastError)}`);
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
