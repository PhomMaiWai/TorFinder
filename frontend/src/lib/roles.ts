/** Mirrors the backend's ROLES (backend/src/common/roles.ts). */
export type Role = "admin" | "org" | "owner" | "auditor" | "viewer";

/** Where a signed-in user lands: the public overview, except admins, who start in their console. */
export function homeFor(role: Role): string {
  return role === "admin" ? "/admin" : "/dashboard";
}
