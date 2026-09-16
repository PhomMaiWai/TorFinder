import { getTranslations } from "next-intl/server";

import { UserList } from "@/components/admin/user-list";
import { AdminPageShell } from "@/components/layout/admin-page";
import { fetchUserDirectory } from "@/lib/admin-api";

import { reactivateAccount, suspendAccount } from "./actions";

export default async function AdminUsersPage() {
  const [users, t] = await Promise.all([fetchUserDirectory(), getTranslations("AdminUsersPage")]);

  return (
    <AdminPageShell title={t("title")} description={t("description")}>
      <UserList users={users} onSuspend={suspendAccount} onReactivate={reactivateAccount} />
    </AdminPageShell>
  );
}
