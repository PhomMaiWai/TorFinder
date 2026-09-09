"use client";

import { Bookmark } from "lucide-react";

import { useSavedTors } from "@/lib/use-saved-tors";

export function SaveTorButton({ torId }: { torId: string }) {
  const { savedIds, toggleSaved } = useSavedTors();
  const isSaved = savedIds.includes(torId);

  return (
    <button
      onClick={() => toggleSaved(torId)}
      className={`flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium shadow-sm transition-colors ${
        isSaved
          ? "border-accent/30 bg-accent-soft text-accent"
          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
      }`}
    >
      <Bookmark size={15} fill={isSaved ? "currentColor" : "none"} />
      <span className="hidden sm:inline">{isSaved ? "บันทึกแล้ว" : "บันทึก"}</span>
    </button>
  );
}
