/** Mirrors the backend's ROLES (backend/src/common/roles.ts). */
export type Role = "admin" | "org" | "owner" | "auditor" | "viewer";

/** Where a signed-in user's own area starts. Viewers have none, so they land on search. */
export function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "auditor") return "/auditor";
  if (role === "viewer") return "/public";
  return "/dashboard";
}
