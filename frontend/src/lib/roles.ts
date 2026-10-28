/** Mirrors the backend's ROLES (backend/src/common/roles.ts). */
export type Role = "admin" | "org" | "owner" | "auditor" | "viewer";

/**
 * Where a signed-in user lands. Admins, the Auditor Office and project owners
 * start on their own pages; everyone else — public viewers included — on the
 * public overview at /dashboard.
 */
export function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "auditor") return "/auditor";
  if (role === "owner") return "/owner";
  return "/dashboard";
}
