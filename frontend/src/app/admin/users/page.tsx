import { getTranslations } from "next-intl/server";

import { UserList } from "@/components/admin/user-list";
import { AdminPageShell } from "@/components/layout/admin-page";
import { fetchAccounts } from "@/lib/accounts-api";

import { reactivateAccount, suspendAccount } from "./actions";

export default async function AdminUsersPage() {
  const [accounts, t] = await Promise.all([fetchAccounts(), getTranslations("AdminUsersPage")]);

  return (
    <AdminPageShell title={t("title")} description={t("description")}>
      <UserList accounts={accounts} onSuspend={suspendAccount} onReactivate={reactivateAccount} />
    </AdminPageShell>
  );
}
