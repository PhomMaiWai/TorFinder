"use client";

import { useEffect, useState } from "react";

import type { Role } from "@/lib/roles";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export { homeFor } from "@/lib/roles";

// Shared across every component that asks, so one page render makes one request.
let pending: Promise<SessionUser | null> | undefined;

function loadSession(): Promise<SessionUser | null> {
  pending ??= fetch("/api/auth/me", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : { user: null }))
    .then((data: { user: SessionUser | null }) => data.user)
    .catch(() => null);
  return pending;
}

/** Forget the shared answer after signing in or out, so the next mount asks again. */
export function resetSession() {
  pending = undefined;
}

/** `undefined` while unknown, so callers can avoid flashing the wrong state. */
export function useSession(): SessionUser | null | undefined {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    loadSession().then((value) => {
      if (active) setUser(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return user;
}
