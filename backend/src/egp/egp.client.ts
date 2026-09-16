import { Injectable, Logger } from "@nestjs/common";

import { HttpClient } from "../common/http-client";
import { EGP_ENDPOINTS, EGP_REQUEST } from "./egp.constants";
import {
  EgpAnnouncement,
  EgpAnnouncementResponse,
  EgpProjectDetail,
  EgpSearchResponse,
} from "./egp.types";

@Injectable()
export class EgpClient {
  private readonly http = new HttpClient(
    EGP_ENDPOINTS.api,
    { timeoutMs: EGP_REQUEST.timeoutMs, maxRetries: EGP_REQUEST.maxRetries },
    new Logger(EgpClient.name),
  );

  searchProjects(announceTypeId: string, page: number, searchText = ""): Promise<EgpSearchResponse> {
    return this.http.get<EgpSearchResponse>("/Projects/GetProjectFromFilter", {
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
    const body = await this.http.get<EgpAnnouncementResponse>(
      "/ProjectAnnouncements/GetAnnouncementDetailInProject",
      { pageNo: "1", pageSize: "20", projectId },
      { timeoutMs: EGP_REQUEST.enrichTimeoutMs, maxRetries: 1 },
    );
    return body.data ?? [];
  }

  /** Procurement method/type/category — structured facts the portal has on file. */
  projectDetail(projectId: string): Promise<EgpProjectDetail> {
    return this.http.get<EgpProjectDetail>(
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
}
