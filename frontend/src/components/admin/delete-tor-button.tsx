"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { hideTor, unhideTor } from "@/app/admin/tor/actions";
import { withStepUp } from "@/lib/passkeys-client";

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
  const tp = useTranslations("Passkeys");
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
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
            setRefusal(null);
            // Deleting a public notice may first ask for a fresh passkey check (ASVS 7.5.3).
            startTransition(async () => {
              const result = await withStepUp(
                () => hideTor(torId),
                (failed) =>
                  failed.message ??
                  (failed.reason === "cancelled" ? tp("cancelled") : failed.reason === "unsupported" ? tp("unsupported") : tp("stepUpFailed")),
              );
              if (result.error) setRefusal(result.error);
            });
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
    <span className="inline-flex flex-col items-start gap-1">
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 font-medium text-ink-muted transition-colors hover:text-danger"
    >
      <Trash2 size={14} />
      {labels.delete}
    </button>
    {refusal && (
      <span role="alert" className="text-xs font-medium text-danger">
        {refusal}
      </span>
    )}
    </span>
  );
}
