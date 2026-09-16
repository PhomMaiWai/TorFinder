import { Skeleton, SkeletonScreen } from "@/components/ui/skeleton";

/** Mirrors the announcement page: the document on the left, its facts on the right. */
export default function TorDetailLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <main className="flex-1 py-8">
        <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-8">
          <SkeletonScreen label="กำลังโหลดรายละเอียดประกาศ">
            <div className="mb-6 space-y-3">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
              <div className="space-y-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="space-y-3 rounded-xl border border-border bg-white p-6">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-white p-5">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-start gap-3 border-b border-border pb-3 last:border-b-0">
                    <Skeleton className="size-4 shrink-0 rounded" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SkeletonScreen>
        </div>
      </main>
    </div>
  );
}
