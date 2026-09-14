"use client";

import { useSyncExternalStore } from "react";

import type { NotificationType } from "@/data/notifications";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  torId?: string;
  read: boolean;
  createdAt: string;
};

const EMPTY_SNAPSHOT: Notification[] = [];

/**
 * A single shared store (unlike use-saved-tors.ts, there's no "public" scope
 * here — every caller is the signed-in account's own list) so the sidebar
 * badge and the notifications page always agree, and marking one read
 * anywhere updates both instantly.
 */
function createStore() {
  let listeners: Array<() => void> = [];
  let cachedSnapshot: Notification[] = EMPTY_SNAPSHOT;
  let hasLoaded = false;

  function notify() {
    listeners.forEach((listener) => listener());
  }

  async function load() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        cachedSnapshot = await res.json();
        notify();
      }
    } catch {
      // Left empty — the sidebar/page just show nothing rather than an error state.
    }
  }

  function subscribe(callback: () => void) {
    listeners.push(callback);
    if (!hasLoaded) {
      hasLoaded = true;
      load();
    }
    return () => {
      listeners = listeners.filter((l) => l !== callback);
    };
  }

  function getSnapshot() {
    return cachedSnapshot;
  }

  /** Optimistic; rolls back if the request fails. A no-op if already read. */
  function markRead(id: string) {
    const target = cachedSnapshot.find((n) => n.id === id);
    if (!target || target.read) return;

    const previous = cachedSnapshot;
    cachedSnapshot = cachedSnapshot.map((n) => (n.id === id ? { ...n, read: true } : n));
    notify();

    fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
      .then((res) => {
        if (!res.ok) throw new Error("mark read failed");
      })
      .catch(() => {
        cachedSnapshot = previous;
        notify();
      });
  }

  function markAllRead() {
    if (cachedSnapshot.every((n) => n.read)) return;

    const previous = cachedSnapshot;
    cachedSnapshot = cachedSnapshot.map((n) => ({ ...n, read: true }));
    notify();

    fetch("/api/notifications/read-all", { method: "PATCH" })
      .then((res) => {
        if (!res.ok) throw new Error("mark all read failed");
      })
      .catch(() => {
        cachedSnapshot = previous;
        notify();
      });
  }

  /** Called on logout — a client-side navigation, not a reload, so this module stays loaded. */
  function reset() {
    cachedSnapshot = EMPTY_SNAPSHOT;
    hasLoaded = false;
    notify();
  }

  return { subscribe, getSnapshot, markRead, markAllRead, reset };
}

let store: ReturnType<typeof createStore> | null = null;

function getStore() {
  store ??= createStore();
  return store;
}

function getServerSnapshot(): Notification[] {
  return EMPTY_SNAPSHOT;
}

/** Clears the cached list so a different account logging in next doesn't see it. */
export function resetNotifications() {
  store?.reset();
}

export function useNotifications() {
  const s = getStore();
  const notifications = useSyncExternalStore(s.subscribe, s.getSnapshot, getServerSnapshot);

  return { notifications, markRead: s.markRead, markAllRead: s.markAllRead };
}
