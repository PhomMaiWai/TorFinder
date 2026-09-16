"use client";

import { Bookmark } from "lucide-react";

import { useSavedTors } from "@/lib/use-saved-tors";

export function SaveTorButton({
  torId,
  saveLabel,
  savedLabel,
}: {
  torId: string;
  saveLabel: string;
  savedLabel: string;
}) {
  const { savedIds, toggleSaved } = useSavedTors();
  const isSaved = savedIds.includes(torId);

  return (
    <button
      onClick={() => toggleSaved(torId)}
      className={`flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium shadow-sm transition-colors ${
        isSaved
          ? "border-accent/30 bg-accent-soft text-accent"
          : "border-border bg-surface text-ink-muted hover:bg-surface-alt"
      }`}
    >
      <Bookmark size={15} fill={isSaved ? "currentColor" : "none"} />
      <span className="hidden sm:inline">{isSaved ? savedLabel : saveLabel}</span>
    </button>
  );
}
