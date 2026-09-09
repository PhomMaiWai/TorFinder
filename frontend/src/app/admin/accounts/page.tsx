import { getTranslations } from "next-intl/server";

import { AccountReviewList } from "@/components/admin/account-review-list";
import { AdminPageShell } from "@/components/layout/admin-page";
import { fetchAccounts } from "@/lib/accounts-api";

import { approveAccount, rejectAccount } from "./actions";

export default async function AdminAccountsPage() {
  const [accounts, t] = await Promise.all([
    fetchAccounts(),
    getTranslations("AdminAccountsPage"),
  ]);

  return (
    <AdminPageShell title={t("title")} description={t("description")}>
      <AccountReviewList
        accounts={accounts}
        onApprove={approveAccount}
        onReject={rejectAccount}
      />
    </AdminPageShell>
  );
}
