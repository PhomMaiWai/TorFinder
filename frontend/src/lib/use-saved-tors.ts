"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useSession } from "@/lib/use-session";

/**
 * One saved list per person, wherever they save from. Signed in, it is the
 * account's own list on the backend, so it follows them to any device.
 * Signed out, it lives in this browser — and the first time that browser
 * signs in, those bookmarks are folded into the account and cleared here,
 * so nothing saved before signing in is lost or left behind.
 */

/** Mock records are keyed by number, records from the backend by ObjectId string. */
export type TorId = string | number;

// Unchanged from when this list was the "public" scope, so existing bookmarks still load.
const STORAGE_KEY = "torr:saved-tors:public";
const EMPTY: TorId[] = [];

function createEmitter() {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit() {
      listeners.forEach((listener) => listener());
    },
    get size() {
      return listeners.size;
    },
  };
}

function toggled(ids: TorId[], id: TorId, saved: boolean): TorId[] {
  const key = String(id);
  const rest = ids.filter((savedId) => String(savedId) !== key);
  return saved ? [...rest, id] : rest;
}

/** This browser's bookmarks, for a visitor who hasn't signed in. */
const browserStore = (() => {
  const emitter = createEmitter();
  let snapshot: TorId[] | null = null;

  function read(): TorId[] {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed : EMPTY;
    } catch {
      // Private mode, blocked storage or a corrupt value: start empty rather than crash.
      return EMPTY;
    }
  }

  function write(next: TorId[]) {
    snapshot = next;
    try {
      if (next.length > 0) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The in-memory list still works for this visit.
    }
    emitter.emit();
  }

  // Another tab saved or unsaved: pick it up instead of overwriting it later.
  function onStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    snapshot = read();
    emitter.emit();
  }

  return {
    subscribe(listener: () => void) {
      if (emitter.size === 0) window.addEventListener("storage", onStorage);
      const unsubscribe = emitter.subscribe(listener);
      return () => {
        unsubscribe();
        if (emitter.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot(): TorId[] {
      snapshot ??= read();
      return snapshot;
    },
    toggle(id: TorId) {
      const current = browserStore.getSnapshot();
      write(toggled(current, id, !current.some((savedId) => String(savedId) === String(id))));
    },
    clear() {
      write(EMPTY);
    },
  };
})();

/**
 * The signed-in account's list. Toggles apply at once and are sent in the
 * background; requests for the same TOR run one after another so a quick
 * save-unsave can't arrive out of order, and a failure rolls back only when
 * no newer toggle of that TOR has replaced it.
 */
const accountStore = (() => {
  const emitter = createEmitter();
  let ownerId: string | null = null;
  let snapshot: TorId[] = EMPTY;
  /** What the person last asked for, per TOR, until the server has confirmed it. */
  const intended = new Map<string, boolean>();
  const queues = new Map<string, Promise<void>>();

  function set(next: TorId[]) {
    snapshot = next;
    emitter.emit();
  }

  async function load(userId: string) {
    const fromBrowser = browserStore.getSnapshot();
    try {
      const res =
        fromBrowser.length > 0
          ? await fetch("/api/saved-tors/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ torIds: fromBrowser.map(String) }),
            })
          : await fetch("/api/saved-tors", { cache: "no-store" });
      if (!res.ok || ownerId !== userId) return;

      const serverIds: string[] = await res.json();
      if (fromBrowser.length > 0) browserStore.clear();
      // Anything toggled while the list was loading still wins over what the server had.
      let next: TorId[] = serverIds;
      intended.forEach((saved, id) => {
        next = toggled(next, id, saved);
      });
      set(next);
    } catch {
      // Left as is: the list shows what it has, and the next toggle still goes through.
    }
  }

  return {
    subscribe: emitter.subscribe,
    /** Only the owner's list, so a different account never flashes the last one's saves. */
    snapshotFor(userId: string): TorId[] {
      return ownerId === userId ? snapshot : EMPTY;
    },
    bind(userId: string) {
      if (ownerId === userId) return;
      ownerId = userId;
      intended.clear();
      queues.clear();
      set(EMPTY);
      void load(userId);
    },
    reset() {
      ownerId = null;
      intended.clear();
      queues.clear();
      set(EMPTY);
    },
    toggle(id: TorId) {
      const owner = ownerId;
      if (!owner) return;
      const key = String(id);
      const saved = !snapshot.some((savedId) => String(savedId) === key);

      intended.set(key, saved);
      set(toggled(snapshot, id, saved));

      const request = (queues.get(key) ?? Promise.resolve())
        .then(async () => {
          const res = await fetch(`/api/saved-tors/${encodeURIComponent(key)}`, {
            method: saved ? "POST" : "DELETE",
          });
          if (!res.ok) throw new Error(`saved-tors ${res.status}`);
        })
        .catch(() => {
          if (ownerId === owner && intended.get(key) === saved) set(toggled(snapshot, id, !saved));
        })
        .finally(() => {
          if (queues.get(key) !== request) return;
          queues.delete(key);
          if (intended.get(key) === saved) intended.delete(key);
        });
      queues.set(key, request);
    },
  };
})();

function getServerSnapshot(): TorId[] {
  return EMPTY;
}

/** Forget the signed-in list on sign-out, so the next person on this browser starts clean. */
export function resetSavedTors() {
  accountStore.reset();
}

export function useSavedTors() {
  const session = useSession();
  const userId = session?.id ?? null;

  useEffect(() => {
    if (userId) accountStore.bind(userId);
  }, [userId]);

  const getAccountSnapshot = useCallback(() => (userId ? accountStore.snapshotFor(userId) : EMPTY), [userId]);
  const accountIds = useSyncExternalStore(accountStore.subscribe, getAccountSnapshot, getServerSnapshot);
  const browserIds = useSyncExternalStore(
    browserStore.subscribe,
    browserStore.getSnapshot,
    getServerSnapshot,
  );

  // Until the session is known, show nothing rather than one list then the other;
  // a save in that moment lands in the browser list, which the account then imports.
  if (session === undefined) return { savedIds: EMPTY, toggleSaved: browserStore.toggle };
  return userId
    ? { savedIds: accountIds, toggleSaved: accountStore.toggle }
    : { savedIds: browserIds, toggleSaved: browserStore.toggle };
}
