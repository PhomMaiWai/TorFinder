import { getTranslations } from "next-intl/server";

import { AdminApprovalList } from "@/components/admin/admin-approval-list";
import { UserList } from "@/components/admin/user-list";
import { AdminPageShell } from "@/components/layout/admin-page";
import { fetchAdminApprovals, fetchUserDirectory } from "@/lib/admin-api";

import {
  approveAdminChange,
  editAccount,
  reactivateAccount,
  rejectAdminChange,
  resetAccountPasskeys,
  sendAccountPasswordReset,
  suspendAccount,
} from "./actions";

export default async function AdminUsersPage() {
  const [users, approvals, t] = await Promise.all([
    fetchUserDirectory(),
    fetchAdminApprovals(),
    getTranslations("AdminUsersPage"),
  ]);

  return (
    <AdminPageShell title={t("title")} description={t("description")}>
      <AdminApprovalList approvals={approvals} onApprove={approveAdminChange} onReject={rejectAdminChange} />
      <UserList
        users={users}
        onSuspend={suspendAccount}
        onReactivate={reactivateAccount}
        onEdit={editAccount}
        onResetPasskeys={resetAccountPasskeys}
        onSendPasswordReset={sendAccountPasswordReset}
      />
    </AdminPageShell>
  );
}
