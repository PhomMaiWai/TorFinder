"use client";

import { useSyncExternalStore } from "react";

/**
 * Saved lists are scoped: "public" is the anonymous TOR-search visitor's
 * bookmarks (SiteNavbar / /public / /saved) — no account to attach them to,
 * so they live in localStorage. "org" is the logged-in company's own saved
 * list (AppShell sidebar, dashboard, /saved?scope=org) — backed by
 * /api/saved-tors so it survives a new device or browser. They must not mix.
 */
export type SavedTorsScope = "public" | "org";

/** Mock records are keyed by number, records from the backend by ObjectId string. */
export type TorId = string | number;

const PUBLIC_STORAGE_KEY = "torr:saved-tors:public";

const EMPTY_SNAPSHOT: TorId[] = [];

type Store = {
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => TorId[];
  toggle: (id: TorId) => void;
  /** Only the remote ("org") store needs this — cleared on logout. */
  reset?: () => void;
};

function readFromStorage(storageKey: string): TorId[] {
  if (typeof window === "undefined") return EMPTY_SNAPSHOT;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as TorId[]) : EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function createLocalStore(storageKey: string): Store {
  let listeners: Array<() => void> = [];
  let cachedSnapshot: TorId[] = readFromStorage(storageKey);

  function subscribe(callback: () => void) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter((l) => l !== callback);
    };
  }

  function getSnapshot() {
    return cachedSnapshot;
  }

  function toggle(id: TorId) {
    cachedSnapshot = cachedSnapshot.includes(id)
      ? cachedSnapshot.filter((savedId) => savedId !== id)
      : [...cachedSnapshot, id];
    window.localStorage.setItem(storageKey, JSON.stringify(cachedSnapshot));
    listeners.forEach((notify) => notify());
  }

  return { subscribe, getSnapshot, toggle };
}

/**
 * Toggling updates optimistically so the button feels instant; a failed
 * request rolls back rather than leaving the UI claiming something the
 * server doesn't have.
 */
function createRemoteStore(): Store {
  let listeners: Array<() => void> = [];
  let cachedSnapshot: TorId[] = EMPTY_SNAPSHOT;
  let hasLoaded = false;

  function notify() {
    listeners.forEach((listener) => listener());
  }

  async function load() {
    try {
      const res = await fetch("/api/saved-tors", { cache: "no-store" });
      if (res.ok) {
        cachedSnapshot = await res.json();
        notify();
      }
    } catch {
      // Left empty — the sidebar/dashboard just show nothing saved rather
      // than an error state; toggling will still work on the next attempt.
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

  function toggle(id: TorId) {
    const wasSaved = cachedSnapshot.includes(id);
    const previous = cachedSnapshot;
    cachedSnapshot = wasSaved
      ? cachedSnapshot.filter((savedId) => savedId !== id)
      : [...cachedSnapshot, id];
    notify();

    fetch(`/api/saved-tors/${id}`, { method: wasSaved ? "DELETE" : "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("saved-tors request failed");
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

  return { subscribe, getSnapshot, toggle, reset };
}

const localStores = new Map<string, Store>();
let orgStore: ReturnType<typeof createRemoteStore> | null = null;

function getStore(scope: SavedTorsScope): Store {
  if (scope === "org") {
    orgStore ??= createRemoteStore();
    return orgStore;
  }

  let store = localStores.get(PUBLIC_STORAGE_KEY);
  if (!store) {
    store = createLocalStore(PUBLIC_STORAGE_KEY);
    localStores.set(PUBLIC_STORAGE_KEY, store);
  }
  return store;
}

function getServerSnapshot(): TorId[] {
  return EMPTY_SNAPSHOT;
}

/** Clears the cached org saved-list so a different account logging in next doesn't see it. */
export function resetOrgSavedTors() {
  orgStore?.reset?.();
}

export function useSavedTors(scope: SavedTorsScope = "public") {
  const store = getStore(scope);
  const savedIds = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);

  return { savedIds, toggleSaved: store.toggle };
}
