"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { hideTor, unhideTor } from "@/app/owner/actions";

/**
 * Delete and restore for one row. Asks once in place rather than opening a
 * dialog: the confirmation belongs next to the row it affects, and a list of
 * public notices should never lose one to a single stray click.
 */
export function DeleteTorButton({
  torId,
  deleted = false,
  labels,
}: {
  torId: string;
  /** A row in the trash view restores instead of deleting. */
  deleted?: boolean;
  labels: { delete: string; confirm: string; cancel: string; restore: string };
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (deleted) {
    return (
      <button
        disabled={isPending}
        onClick={() => startTransition(() => void unhideTor(torId))}
        className="inline-flex items-center gap-1 font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
      >
        <RotateCcw size={14} />
        {labels.restore}
      </button>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          disabled={isPending}
          onClick={() => {
            setConfirming(false);
            startTransition(() => void hideTor(torId));
          }}
          className="font-semibold text-danger transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {labels.confirm}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {labels.cancel}
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 font-medium text-ink-muted transition-colors hover:text-danger"
    >
      <Trash2 size={14} />
      {labels.delete}
    </button>
  );
}
