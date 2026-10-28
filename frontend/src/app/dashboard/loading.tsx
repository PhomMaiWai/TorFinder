import { Skeleton, SkeletonCard, SkeletonScreen } from "@/components/ui/skeleton";

/**
 * No shell here: whether the overview opens in the workspace sidebar or the
 * public navbar depends on the session, which isn't known until it renders.
 */
export default function DashboardLoading() {
  return (
    <main className="aurora min-h-screen bg-surface-alt/40">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
        <SkeletonScreen label="กำลังรวบรวมภาพรวมของประกาศทั้งหมด">
          <div className="grid gap-8 rounded-3xl border border-border/60 bg-surface/60 p-8 lg:grid-cols-2">
            <div className="space-y-3">
              <Skeleton className="h-6 w-56 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-14 w-64" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="h-60 w-full rounded-2xl" />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
        </SkeletonScreen>
      </div>
    </main>
  );
}
