"use client";

import { useTranslations } from "next-intl";

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
  const t = useTranslations("ErrorState");
  return (
    <AdminPageShell title={t("pageTitle")} description={t("adminDescription")}>
      <ErrorState error={error} reset={reset} />
    </AdminPageShell>
  );
}
