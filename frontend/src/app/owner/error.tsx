"use client";

import { PageBody, PageHeader } from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import { ErrorState } from "@/components/ui/error-state";

/** Keeps the sidebar around the failure, so the owner can still navigate away or retry. */
export default function OwnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell>
      <PageHeader title="เกิดข้อผิดพลาด" description="โหลดโครงการของคุณไม่สำเร็จ" />
      <PageBody>
        <ErrorState error={error} reset={reset} />
      </PageBody>
    </AppShell>
  );
}
