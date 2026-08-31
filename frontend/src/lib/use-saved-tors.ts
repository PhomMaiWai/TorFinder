"use client";

import { useSyncExternalStore } from "react";

/**
 * Saved lists are scoped: "public" is the anonymous TOR-search visitor's
 * bookmarks (SiteNavbar / /public / /saved), "org" is the logged-in
 * company's own saved list (AppShell sidebar) — they must not mix.
 */
export type SavedTorsScope = "public" | "org";

const STORAGE_KEYS: Record<SavedTorsScope, string> = {
  public: "torr:saved-tors:public",
  org: "torr:saved-tors:org",
};

const EMPTY_SNAPSHOT: number[] = [];

function readFromStorage(storageKey: string): number[] {
  if (typeof window === "undefined") return EMPTY_SNAPSHOT;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as number[]) : EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function createStore(storageKey: string) {
  let listeners: Array<() => void> = [];
  let cachedSnapshot: number[] = readFromStorage(storageKey);

  function subscribe(callback: () => void) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter((l) => l !== callback);
    };
  }

  function getSnapshot() {
    return cachedSnapshot;
  }

  function toggle(id: number) {
    cachedSnapshot = cachedSnapshot.includes(id)
      ? cachedSnapshot.filter((savedId) => savedId !== id)
      : [...cachedSnapshot, id];
    window.localStorage.setItem(storageKey, JSON.stringify(cachedSnapshot));
    listeners.forEach((notify) => notify());
  }

  return { subscribe, getSnapshot, toggle };
}

const stores = new Map<string, ReturnType<typeof createStore>>();

function getStore(scope: SavedTorsScope) {
  const storageKey = STORAGE_KEYS[scope];
  let store = stores.get(storageKey);
  if (!store) {
    store = createStore(storageKey);
    stores.set(storageKey, store);
  }
  return store;
}

function getServerSnapshot(): number[] {
  return EMPTY_SNAPSHOT;
}

export function useSavedTors(scope: SavedTorsScope = "public") {
  const store = getStore(scope);
  const savedIds = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);

  return { savedIds, toggleSaved: store.toggle };
}
