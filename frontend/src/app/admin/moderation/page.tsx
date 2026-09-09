import { getTranslations } from "next-intl/server";

import { AdminPageShell } from "@/components/layout/admin-page";
import { ModerationList } from "@/components/admin/moderation-list";
import { fetchFeedbackQueue } from "@/lib/feedback-api";
import { fetchTorList } from "@/lib/tor-api";

export default async function AdminModerationPage() {
  const [feedback, tors, t] = await Promise.all([
    fetchFeedbackQueue(),
    // Comments carry a TOR id, not a title; the list is fetched once and used
    // as a lookup rather than asking the API per comment.
    fetchTorList(1, 100),
    getTranslations("AdminModerationPage"),
  ]);

  const titles = Object.fromEntries(tors.map((tor) => [tor.id, tor.title]));

  return (
    <AdminPageShell title={t("title")} description={t("description")}>
      <ModerationList
        items={feedback}
        titles={titles}
        labels={{
          approve: t("approveAction"),
          reject: t("rejectAction"),
          empty: t("emptyQueue"),
        }}
      />
    </AdminPageShell>
  );
}
