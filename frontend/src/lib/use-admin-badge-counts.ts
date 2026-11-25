"use client";

import { useSyncExternalStore } from "react";

import { pollWhileVisible } from "@/lib/poll-while-visible";

export type AdminBadgeCounts = {
  pendingAccounts: number;
  pendingFeedback: number;
};

const EMPTY: AdminBadgeCounts = { pendingAccounts: 0, pendingFeedback: 0 };

/**
 * The admin sidebar's pending counts, shared by every caller. Read when the
 * first component subscribes, re-read every 30s while the tab is visible, and
 * re-read on demand after the admin approves or rejects something.
 */
function createStore() {
  let listeners: Array<() => void> = [];
  let snapshot: AdminBadgeCounts = EMPTY;
  let stopPolling: (() => void) | null = null;

  function notify() {
    listeners.forEach((listener) => listener());
  }

  async function refresh() {
    try {
      const res = await fetch("/api/admin/badge-counts", { cache: "no-store" });
      if (!res.ok) return;
      const next: AdminBadgeCounts = await res.json();
      if (
        next.pendingAccounts === snapshot.pendingAccounts &&
        next.pendingFeedback === snapshot.pendingFeedback
      ) {
        return;
      }
      snapshot = next;
      notify();
    } catch {
      // Keep the last counts; the next poll tries again.
    }
  }

  function subscribe(callback: () => void) {
    listeners.push(callback);
    if (!stopPolling) {
      refresh();
      stopPolling = pollWhileVisible(refresh);
    }
    return () => {
      listeners = listeners.filter((l) => l !== callback);
      if (listeners.length === 0 && stopPolling) {
        stopPolling();
        stopPolling = null;
      }
    };
  }

  function getSnapshot() {
    return snapshot;
  }

  /** Called on logout so the next account doesn't see these counts. */
  function reset() {
    snapshot = EMPTY;
    notify();
  }

  return { subscribe, getSnapshot, refresh, reset };
}

let store: ReturnType<typeof createStore> | null = null;

function getStore() {
  store ??= createStore();
  return store;
}

function getServerSnapshot(): AdminBadgeCounts {
  return EMPTY;
}

/** Re-reads the counts now — after an approve/reject, so the badge drops at once. */
export function refreshAdminBadgeCounts() {
  return store?.refresh();
}

export function resetAdminBadgeCounts() {
  store?.reset();
}

function subscribeNothing() {
  return () => {};
}

/** `enabled` is false outside the admin workspace, so a company account never polls. */
export function useAdminBadgeCounts(enabled: boolean) {
  const s = getStore();
  return useSyncExternalStore(
    enabled ? s.subscribe : subscribeNothing,
    enabled ? s.getSnapshot : getServerSnapshot,
    getServerSnapshot,
  );
}
