import { AppShell } from "@/components/layout/app-sidebar";
import { Skeleton, SkeletonRow, SkeletonScreen } from "@/components/ui/skeleton";

export default function SavedLoading() {
  return (
    <AppShell>
      <main className="flex min-h-screen flex-col bg-surface-alt/50">
        <header className="shrink-0 border-b border-border bg-surface px-8 py-7">
          <div className="mx-auto w-full max-w-[1400px] space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1400px] px-8 py-8">
          <SkeletonScreen label="กำลังโหลดประกาศที่บันทึกไว้">
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {Array.from({ length: 5 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </SkeletonScreen>
        </div>
      </main>
    </AppShell>
  );
}
