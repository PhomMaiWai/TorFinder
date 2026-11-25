/** Mirrors the backend's ROLES (backend/src/common/roles.ts). */
export type Role = "admin" | "org" | "viewer";

/**
 * Where a signed-in user lands. Admins start on their own console, companies
 * on the public TOR search (their workspace is one click away in the navbar),
 * public viewers on the public overview at /dashboard.
 */
export function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "org") return "/public";
  return "/dashboard";
}

/**
 * Where the account button in the public navbar leads. A company lands on the
 * public pages like everyone else and enters its workspace (the sidebar with
 * profile, matches, library…) from there, through the workspace's own view
 * of the overview.
 */
export function workspaceFor(role: Role): string {
  if (role === "org") return "/dashboard?in=app";
  return homeFor(role);
}
