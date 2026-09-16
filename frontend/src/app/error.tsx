"use client";

import { ErrorState } from "@/components/ui/error-state";

/**
 * Catches anything a route below didn't: a backend that stopped answering, a
 * read that threw. Admin has its own, because it sits inside a different shell.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <ErrorState error={error} reset={reset} />
    </div>
  );
}
