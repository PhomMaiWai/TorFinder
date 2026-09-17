import { AppShell } from "@/components/layout/app-sidebar";
import { Skeleton, SkeletonCard, SkeletonScreen } from "@/components/ui/skeleton";

/** The sidebar stays put while the ranked list is being worked out. */
export default function DashboardLoading() {
  return (
    <AppShell>
      <main className="flex min-h-screen flex-col bg-surface-alt/50">
        <header className="shrink-0 border-b border-border bg-surface px-8 py-7">
          <div className="mx-auto w-full max-w-[1400px] space-y-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1400px] px-8 py-8">
          <SkeletonScreen label="กำลังจัดอันดับประกาศที่ตรงกับบริษัทของคุณ">
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>

            <div className="space-y-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex gap-5 rounded-xl border border-border bg-surface p-5">
                  <Skeleton className="hidden size-14 shrink-0 rounded-full sm:block" />
                  <div className="flex-1 space-y-2.5">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="flex gap-2 pt-1">
                      <Skeleton className="h-6 w-24 rounded-md" />
                      <Skeleton className="h-6 w-20 rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SkeletonScreen>
        </div>
      </main>
    </AppShell>
  );
}
