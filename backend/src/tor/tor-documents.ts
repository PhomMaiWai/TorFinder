/**
 * Which of an announcement's links is a document and which is a web page.
 *
 * Every portal publishes both under the same `documents` list: e-GP leaves the
 * file path empty on most announcements and falls back to the project's listing
 * page, and MEA's detail link sits next to its attachments. Only a real file
 * can be downloaded and read, so the distinction lives here — one place, beside
 * the records it describes, rather than inside whatever happens to need it.
 */

/** The upload path each portal serves its files from. */
const FILE_PATH_MARKERS = ["/api/file/", "/files_procurement/"] as const;

export function isDocumentFile(url: string): boolean {
  return FILE_PATH_MARKERS.some((marker) => url.includes(marker));
}

/**
 * A file the extractor can actually hand to a model. Both portals keep the
 * extension on the stored name, so a spreadsheet or the occasional .zip is
 * ruled out before it costs a download — the content type is still checked on
 * the way in, because a portal can serve an error page with any name.
 */
export function isReadableDocument(url: string): boolean {
  return isDocumentFile(url) && url.toLowerCase().split("?")[0].endsWith(".pdf");
}

/**
 * The same rule as a Mongo pattern, so a query can select the records this
 * module would accept. It lives next to the predicate deliberately: a query
 * that selects more than the code accepts hands the extractor records it then
 * refuses, and every one of those is a wasted place in the run's budget.
 */
export const READABLE_DOCUMENT_PATTERN = `(${FILE_PATH_MARKERS.join("|")}).*\\.pdf$`;
