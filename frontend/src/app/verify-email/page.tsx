import { AuthCard } from "@/components/auth/auth-card";

import { VerifyEmailPanel } from "./verify-email-panel";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard>
      <VerifyEmailPanel token={token ?? null} />
    </AuthCard>
  );
}
