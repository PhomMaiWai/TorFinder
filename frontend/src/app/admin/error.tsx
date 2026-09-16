"use client";

import { AdminPageShell } from "@/components/layout/admin-page";
import { ErrorState } from "@/components/ui/error-state";

/** Keeps the admin chrome around the failure, so the sidebar still navigates. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminPageShell title="เกิดข้อผิดพลาด" description="โหลดข้อมูลส่วนนี้ไม่สำเร็จ">
      <ErrorState error={error} reset={reset} />
    </AdminPageShell>
  );
}
