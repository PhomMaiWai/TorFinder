/**
 * Where browsers report Content-Security-Policy violations (ASVS 3.4.7): both
 * the older `report-uri` form (`application/csp-report`, one object) and the
 * Reporting API (`application/reports+json`, an array). Each report becomes
 * one JSON line on stdout, like the backend's security events, so a blocked
 * injection attempt, or a script the policy forgot, shows up in the logs.
 *
 * Anyone can post here, so it trusts nothing it is sent: the body is capped,
 * only a few fields are kept and cut short, query strings are dropped (a
 * reset or verify page carries a one-time `?token=`), and the number of lines
 * per minute is capped so a flood can't fill the log.
 */

const MAX_BODY_BYTES = 16 * 1024;
const MAX_FIELD = 254;
const MAX_LINES_PER_MINUTE = 120;

let windowStart = 0;
let linesInWindow = 0;

/** A URL without its query and fragment, or a keyword such as "inline" as it came. */
function withoutQuery(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const cut = value.split(/[?#]/)[0];
  return cut.slice(0, MAX_FIELD);
}

function field(value: unknown): string | undefined {
  return typeof value === "string" && value ? value.slice(0, MAX_FIELD) : undefined;
}

type RawReport = Record<string, unknown>;

/** The two report shapes, reduced to the same few fields. */
function normalise(report: RawReport) {
  // Reporting API: { type: "csp-violation", body: { blockedURL, effectiveDirective, ... } }
  const body = (report.body && typeof report.body === "object" ? report.body : report) as RawReport;
  return {
    directive: field(body.effectiveDirective ?? body["effective-directive"] ?? body["violated-directive"]),
    blocked: withoutQuery(body.blockedURL ?? body["blocked-uri"]),
    document: withoutQuery(body.documentURL ?? body["document-uri"] ?? report.url),
    source: withoutQuery(body.sourceFile ?? body["source-file"]),
    line: typeof (body.lineNumber ?? body["line-number"]) === "number" ? (body.lineNumber ?? body["line-number"]) : undefined,
    disposition: field(body.disposition),
  };
}

function allowLine(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    linesInWindow = 0;
  }
  linesInWindow += 1;
  return linesInWindow <= MAX_LINES_PER_MINUTE;
}

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  const reports: RawReport[] = Array.isArray(parsed)
    ? parsed.filter((item): item is RawReport => Boolean(item) && typeof item === "object").slice(0, 10)
    : parsed && typeof parsed === "object" && "csp-report" in parsed
      ? [(parsed as { "csp-report": RawReport })["csp-report"]]
      : [];

  for (const report of reports) {
    if (!report || typeof report !== "object" || !allowLine()) continue;
    console.warn(
      JSON.stringify({
        time: new Date().toISOString(),
        event: "csp.violation",
        outcome: "failure",
        ...normalise(report),
      }),
    );
  }
  return new Response(null, { status: 204 });
}
