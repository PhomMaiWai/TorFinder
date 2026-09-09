import { Injectable, Logger } from "@nestjs/common";

import { EGP_ENDPOINTS, EGP_REQUEST, EGP_USER_AGENT } from "./egp.constants";
import {
  EgpAnnouncement,
  EgpAnnouncementResponse,
  EgpProjectDetail,
  EgpSearchResponse,
} from "./egp.types";

/** 4xx other than 429 mean the request itself is wrong, so retrying can't help. */
class EgpHttpError extends Error {
  constructor(readonly status: number) {
    super(`e-GP responded ${status}`);
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

type RequestOptions = {
  timeoutMs?: number;
  maxRetries?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class EgpClient {
  private readonly logger = new Logger(EgpClient.name);

  searchProjects(announceTypeId: string, page: number, searchText = ""): Promise<EgpSearchResponse> {
    return this.getJson<EgpSearchResponse>("/Projects/GetProjectFromFilter", {
      projectSearchText: searchText,
      masterAnnounceTypeId: announceTypeId,
      startDate: "",
      endDate: "",
      pageNo: String(page),
      pageSize: String(EGP_REQUEST.pageSize),
      sortBy: "publishDateDesc",
    });
  }

  /**
   * Supplementary detail, not what decides which projects get imported — a slow
   * response here shouldn't cost as much as a slow search, so it gets its own
   * short timeout and no retry (the caller's enrichment budget handles retrying
   * on a later sync instead).
   */
  async announcements(projectId: string): Promise<EgpAnnouncement[]> {
    const body = await this.getJson<EgpAnnouncementResponse>(
      "/ProjectAnnouncements/GetAnnouncementDetailInProject",
      { pageNo: "1", pageSize: "20", projectId },
      { timeoutMs: EGP_REQUEST.enrichTimeoutMs, maxRetries: 1 },
    );
    return body.data ?? [];
  }

  /** Procurement method/type/category — structured facts the portal has on file. */
  projectDetail(projectId: string): Promise<EgpProjectDetail> {
    return this.getJson<EgpProjectDetail>(
      "/Projects/GetProjectDetail",
      { projectId },
      { timeoutMs: EGP_REQUEST.enrichTimeoutMs, maxRetries: 1 },
    );
  }

  /** The public page for a project, used when no specific document is available. */
  listingUrl(projectId: string): string {
    return `${EGP_ENDPOINTS.listing}/${projectId}`;
  }

  /** Direct link to one announcement's actual PDF, e.g. the TOR document itself. */
  fileUrl(announcementId: string, filename: string): string {
    return `${EGP_ENDPOINTS.file}/${announcementId}/${encodeURIComponent(filename)}`;
  }

  private async getJson<T>(
    path: string,
    query: Record<string, string>,
    options: RequestOptions = {},
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? EGP_REQUEST.timeoutMs;
    const maxRetries = options.maxRetries ?? EGP_REQUEST.maxRetries;

    const url = new URL(`${EGP_ENDPOINTS.api}${path}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": EGP_USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new EgpHttpError(res.status);
        return (await res.json()) as T;
      } catch (error) {
        lastError = error;
        if (error instanceof EgpHttpError && !error.retryable) break;
        if (attempt === maxRetries - 1) break;
        // Exponential backoff: the portal rate-limits bursts from one client.
        await sleep(2 ** attempt * 500);
      }
    }

    this.logger.warn(`e-GP request failed: ${path} — ${String(lastError)}`);
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
