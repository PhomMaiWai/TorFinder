"use client";

import { RefreshCw } from "lucide-react";
import { useFormStatus } from "react-dom";

export function RunAgainButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-alt disabled:opacity-50"
    >
      <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
      {pending ? pendingLabel : label}
    </button>
  );
}
