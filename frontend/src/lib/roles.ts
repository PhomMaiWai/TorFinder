/** Mirrors the backend's ROLES (backend/src/common/roles.ts). */
export type Role = "admin" | "org" | "owner" | "viewer";

/**
 * Where a signed-in user lands. Admins and project owners start on their own
 * pages; everyone else — public viewers included — on the public overview at
 * /dashboard.
 */
export function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "owner") return "/owner";
  return "/dashboard";
}
