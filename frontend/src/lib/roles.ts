/** Mirrors the backend's ROLES (backend/src/common/roles.ts). */
export type Role = "admin" | "org" | "viewer";

/**
 * Where a signed-in user lands. Admins start on their own console; everyone else — public viewers included — on the public overview at
 * /dashboard.
 */
export function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  return "/dashboard";
}
