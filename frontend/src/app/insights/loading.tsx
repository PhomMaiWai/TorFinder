import { Skeleton, SkeletonCard, SkeletonScreen } from "@/components/ui/skeleton";

/** No shell here, as on /dashboard: which one depends on the session. */
export default function InsightsLoading() {
  return (
    <main className="aurora min-h-screen bg-surface-alt/40">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
        <SkeletonScreen label="กำลังรวบรวมข้อมูลผู้ชนะการประกวดราคา">
          <Skeleton className="h-28 w-full rounded-3xl" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="mt-6 h-96 w-full rounded-2xl" />
        </SkeletonScreen>
      </div>
    </main>
  );
}
