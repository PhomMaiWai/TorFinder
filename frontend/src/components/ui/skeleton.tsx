/**
 * The grey stand-in a skeleton screen is made of. Every loading state composes
 * this one shape, so a page that is loading reads as the same material
 * everywhere rather than as a different placeholder per screen.
 *
 * `aria-hidden`: a screen reader is told the route is busy by the surrounding
 * live region, not by a wall of empty boxes.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-surface-alt motion-reduce:animate-none ${className}`}
    />
  );
}

/**
 * A loading screen as a whole. Announces itself once, quietly, and lays its
 * children out the way the real page lays out its content — a skeleton that
 * doesn't match the page it replaces just moves the flicker to the handover.
 */
export function SkeletonScreen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** One row of a list: a title line, a detail line under it, and a trailing chip. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-6 w-20 shrink-0 rounded-md" />
    </div>
  );
}

/** A card of the kind the dashboards and listings are built from. */
export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <Skeleton className="size-9 rounded-lg" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}
