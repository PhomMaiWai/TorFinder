import { AuthCard } from "@/components/auth/auth-card";

import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard>
      <ResetPasswordForm token={token ?? null} />
    </AuthCard>
  );
}
