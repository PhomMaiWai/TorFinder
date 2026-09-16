import { AppShell } from "@/components/layout/app-sidebar";
import { Skeleton, SkeletonCard, SkeletonRow, SkeletonScreen } from "@/components/ui/skeleton";

/**
 * One loading screen for every admin route: they share a header, a row of
 * summary cards and a list, so a skeleton per page would be five copies of this.
 */
export default function AdminLoading() {
  return (
    <AppShell>
      <main className="flex min-h-screen flex-col bg-zinc-50/50">
        <header className="shrink-0 border-b border-zinc-200 bg-white px-8 py-7">
          <div className="mx-auto w-full max-w-[1400px] space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1400px] px-8 py-8">
          <SkeletonScreen label="กำลังโหลดข้อมูลผู้ดูแลระบบ">
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-white">
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </SkeletonScreen>
        </div>
      </main>
    </AppShell>
  );
}
