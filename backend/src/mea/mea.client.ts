import { Injectable, Logger } from "@nestjs/common";

import { HttpClient } from "../common/http-client";
import { MEA_ANNOUNCE_TYPES, MEA_ENDPOINTS, MEA_REQUEST, MeaAnnounceType } from "./mea.constants";
import { MeaAnnouncement, MeaDataTableResponse, MeaDetail } from "./mea.types";

/** The DataTables request the listings expect; only the window ever varies. */
function searchForm(start: number, length: number): Record<string, string> {
  return {
    draw: "1",
    start: String(start),
    length: String(length),
    "search[value]": "",
    "search[regex]": "false",
  };
}

/**
 * One `<th scope="row">label</th><td>value</td>` pair — how every fact on a
 * detail page is published. Both halves stop at the first closing tag, so a row
 * can never swallow the ones after it.
 */
const TABLE_ROW = /<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g;

/**
 * The value of the row whose label starts with `label`. `label` is matched as a prefix because
 * the site's own labels carry typos ("หน่วยงานที่่จัดซื้อจัดจ้าง") that a
 * pass over the page must survive.
 */
function rowValue(html: string, label: string): string | null {
  for (const [, head, cell] of html.matchAll(TABLE_ROW)) {
    if (stripTags(head).startsWith(label)) return stripTags(cell);
  }
  return null;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** One table cell. Non-greedy, so a cell never swallows the ones after it. */
const TABLE_CELL = /<td[^>]*>([\s\S]*?)<\/td>/g;

/** Attachments live under the site's own upload path; other links are navigation. */
const FILE_LINK = /href="([^"]*\/files_procurement\/[^"]+)"/g;

/**
 * The file's printed name, out of the cell holding it: everything before the
 * size note the site appends, minus the two action links that follow it.
 */
function fileLabel(cell: string): string {
  return stripTags(cell)
    .split("[ขนาดไฟล์")[0]
    .replace(/(ดูเอกสาร|ดาวน์โหลด)\s*/g, "")
    .trim();
}

/** "2,144,669.48 บาท" — the portal's only numeric format. */
function parseBaht(text: string | null): number | undefined {
  if (!text) return undefined;
  const amount = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

@Injectable()
export class MeaClient {
  private readonly http = new HttpClient(
    MEA_ENDPOINTS.site,
    { timeoutMs: MEA_REQUEST.timeoutMs, maxRetries: MEA_REQUEST.maxRetries },
    new Logger(MeaClient.name),
    // The site probes for cookie support by redirecting to itself with this
    // flag until a client sends it back. Nothing identifies us and nothing is
    // stored — without it every request redirects until fetch gives up.
    { Cookie: "AspxAutoDetectCookieSupport=1" },
  );

  /**
   * Every announcement of one type, with the two response shapes flattened so
   * callers never see the difference: `/Draft` hands back its whole table at
   * once, the other two page like any DataTable — and the awards listing runs
   * to ~10,000 rows, so paging it is not optional.
   */
  async announcements(type: MeaAnnounceType): Promise<MeaAnnouncement[]> {
    const rows: MeaAnnouncement[] = [];

    for (let start = 0; ; start += MEA_REQUEST.pageSize) {
      const body = await this.http.postForm<MeaDataTableResponse | MeaAnnouncement[]>(
        `/${type.path}/Search`,
        searchForm(start, MEA_REQUEST.pageSize),
      );

      if (Array.isArray(body)) return body;

      const page = body.data ?? [];
      rows.push(...page);
      // `recordsTotal` is the size of the whole table, not of this page —
      // checking the page too stops a listing that shrinks mid-sync from
      // looping on an empty tail.
      if (page.length === 0 || rows.length >= body.recordsTotal) return rows;
    }
  }

  /**
   * The facts only the announcement's own page carries: the budget and the
   * buying department for the listings that publish neither, plus the attached
   * documents. Supplementary by design — a failure here costs the extra
   * fields, not the announcement.
   */
  async detail(type: MeaAnnounceType, keyId: string): Promise<MeaDetail> {
    const html = await this.http.getText(`/${type.path}/Detail/${keyId}`, {
      timeoutMs: MEA_REQUEST.detailTimeoutMs,
      maxRetries: 1,
    });

    return {
      budgetAmount: parseBaht(rowValue(html, "วงเงินงบประมาณ")),
      // What was agreed beats what was offered: on the announcements that
      // publish both they are usually equal, and where they differ the agreed
      // figure is the one that became a contract.
      awardedAmount:
        parseBaht(rowValue(html, "ราคารวมที่ตกลง")) ?? parseBaht(rowValue(html, "ราคารวมที่เสนอ")),
      department: rowValue(html, "หน่วยงาน") ?? undefined,
      documents: this.parseDocuments(html),
    };
  }

  /** The public page for one announcement — the citable link for an import. */
  detailUrl(type: MeaAnnounceType, keyId: string): string {
    return `${MEA_ENDPOINTS.site}/${type.path}/Detail/${keyId}`;
  }

  /**
   * The attachments, each carrying the name the page prints rather than the one
   * the file is stored under — the stored name is a random string, so a reader
   * (and the model picking which document to read) would have nothing to go on.
   *
   * Taken from the table cell the link sits in, because the two page layouts
   * put the name in different places: the draft table makes it the link text,
   * the announcement table prints it beside the link with the file size.
   */
  private parseDocuments(html: string): MeaDetail["documents"] {
    const seen = new Set<string>();
    const documents: MeaDetail["documents"] = [];

    for (const [, cell] of html.matchAll(TABLE_CELL)) {
      if (!cell.includes("files_procurement")) continue;
      const label = fileLabel(cell);

      for (const [, url] of cell.matchAll(FILE_LINK)) {
        if (seen.has(url)) continue;
        seen.add(url);
        documents.push({ label: label || decodeURIComponent(url.split("/").pop() ?? ""), url });
      }
    }
    return documents;
  }

  /** The listings that map onto a TOR stage, in publication order. */
  get types(): readonly MeaAnnounceType[] {
    return MEA_ANNOUNCE_TYPES;
  }
}
