/**
 * The longest path (with its query string) the frontend sends to the backend
 * (ASVS 4.2.5). Node refuses a request whose headers, URL included, pass
 * 16 KB; every real call is far below this, so anything longer means a value
 * from the browser grew past what the backend will take, and it is refused
 * here with 414 rather than sent.
 */
export const MAX_BACKEND_PATH = 2048;

export const isBackendPathTooLong = (path: string) => path.length > MAX_BACKEND_PATH;

/** Every record id the backend issues is a MongoDB ObjectId: 24 hex characters. */
const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID.test(value);
}

/**
 * An id as one segment of a backend URL. Server actions and route params are
 * values the browser chose, so an id like `..` or `x/../../accounts` would
 * otherwise walk the request to a different backend path (CodeQL
 * js/request-forgery). Only a real ObjectId gets through, and it is encoded
 * anyway; `encodeURIComponent` alone isn't enough, because `fetch` still
 * resolves a bare `..` segment.
 */
export function idPath(id: unknown): string {
  if (!isObjectId(id)) throw new Error("Invalid record id");
  return encodeURIComponent(id);
}

/**
 * True when every segment of a backend path is an ordinary name: no `.` or
 * `..`, and no `/` or `\` hidden by percent-encoding. The shared proxy
 * (`backend-proxy.ts`) refuses any other path, as a last line behind
 * `idPath()` at each route.
 */
export function isPlainPath(path: string): boolean {
  return path.split("/").every((segment) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return false;
    }
    return decoded !== "." && decoded !== ".." && !decoded.includes("/") && !decoded.includes("\\");
  });
}
