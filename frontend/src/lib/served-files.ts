/**
 * ASVS 13.4.7: the web tier serves only the files it is meant to. Next.js
 * serves its build output (`/_next/static`) and `public/` (empty); the
 * proxy's matcher lets image, font, `.txt` and `.xml` requests go straight
 * through. Every other request reaches the proxy, and no page or id has a dot
 * in its path, so a path with a dot in any segment there is a request for a
 * file the site doesn't have (`/.env`, `/.git/config`, `/backup.zip`,
 * `/index.php`). It gets a plain 404 before any routing.
 *
 * API routes are left alone: they serve files by id, and the backend decides.
 */
export function isUnexpectedFile(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return false;
  return pathname.split("/").some((segment) => segment.includes("."));
}
