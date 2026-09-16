import { Skeleton, SkeletonScreen } from "@/components/ui/skeleton";

/** Mirrors the search page: heading, filter bar, then the result cards. */
export default function PublicLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-alt">
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-8">
          <SkeletonScreen label="กำลังโหลดประกาศ">
            <div className="mb-8 space-y-3">
              <Skeleton className="h-9 w-72 max-w-full" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>

            <Skeleton className="mb-6 h-12 w-full rounded-xl" />

            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-3 rounded-xl border border-border bg-surface p-5">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-6 w-20 rounded-md" />
                    <Skeleton className="h-6 w-16 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </SkeletonScreen>
        </div>
      </main>
    </div>
  );
}
