import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

import { AuditorPageShell } from "@/components/layout/auditor-page";
import { type FlaggedTorFilter, fetchFlaggedTors } from "@/lib/tor-admin-api";
import { stageBadgeCls } from "@/lib/tor-ui";

const TABS = [
  { id: "all", label: "ทั้งหมด", flag: undefined },
  { id: "budget-high", label: "ราคาสูงผิดปกติ", flag: "budget-high" },
  { id: "budget-low", label: "ราคาต่ำผิดปกติ", flag: "budget-low" },
  { id: "competition", label: "แข่งขันน้อยราย", flag: "competition" },
] satisfies { id: string; label: string; flag: FlaggedTorFilter | undefined }[];

type TabId = (typeof TABS)[number]["id"];

/** Anything else in the query string — a stale link, a typo — falls back to "all". */
const isTab = (value: string | undefined): value is TabId => TABS.some((tab) => tab.id === value);

export default async function AuditorPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; flag?: string }>;
}) {
  const { page: pageParam, flag: flagParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const tab = isTab(flagParam) ? flagParam : "all";
  const flag = TABS.find((t) => t.id === tab)?.flag;

  const { items, total, pageSize } = await fetchFlaggedTors(page, flag);

  return (
    <AuditorPageShell
      title="รายการที่ถูกตรวจสอบ"
      description="โครงการที่วงเงินงบประมาณผิดปกติ หรือจัดซื้อจัดจ้างด้วยวิธีที่มีผู้เสนอราคาน้อยราย"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/auditor?flag=${t.id}`}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-ink text-white" : "text-ink-muted hover:bg-surface-alt hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {items.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">ไม่พบรายการที่ถูกตรวจสอบ</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt text-left text-xs text-ink-muted">
                    <th className="px-5 py-3 font-medium">ชื่อโครงการ</th>
                    <th className="px-5 py-3 font-medium">หน่วยงาน</th>
                    <th className="px-5 py-3 font-medium">สถานะ</th>
                    <th className="px-5 py-3 font-medium">งบประมาณ</th>
                    <th className="px-5 py-3 font-medium">เหตุผล</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((tor) => (
                    <tr key={tor.id} className="border-b border-border last:border-0">
                      <td className="max-w-xs truncate px-5 py-3 font-medium text-ink">{tor.title}</td>
                      <td className="px-5 py-3 text-ink-muted">{tor.agency}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-2xs font-semibold ${stageBadgeCls(tor.stage)}`}
                        >
                          {tor.stage}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-muted">{tor.budget}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {tor.budgetStatus && (
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold ${
                                tor.budgetStatus === "สูงกว่าปกติ"
                                  ? "bg-danger-soft text-danger"
                                  : "bg-warn-soft text-warn"
                              }`}
                            >
                              {tor.budgetStatus === "สูงกว่าปกติ" ? (
                                <TrendingUp size={12} />
                              ) : (
                                <TrendingDown size={12} />
                              )}
                              {tor.budgetStatus}
                            </span>
                          )}
                          {tor.procurementMethod && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-2xs font-semibold text-warn">
                              <Users size={12} />
                              {tor.procurementMethod}
                            </span>
                          )}
                        </div>
                        <ul className="mt-1 max-w-xs list-none space-y-0.5 text-xs text-ink-muted">
                          {tor.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/tor/${tor.id}`}
                          className="font-medium text-accent hover:text-accent-dark"
                        >
                          ดูรายละเอียด
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Link
            href={`/auditor?flag=${tab}&page=${Math.max(1, page - 1)}`}
            aria-disabled={page <= 1}
            className={`flex items-center gap-1 text-sm font-medium ${
              page <= 1 ? "pointer-events-none text-ink-subtle" : "text-ink-muted hover:text-ink"
            }`}
          >
            <ChevronLeft size={16} />
            ก่อนหน้า
          </Link>
          <span className="text-sm text-ink-muted">
            หน้า {page}
            {total > 0 ? ` · ทั้งหมด ${total} รายการ` : ""}
          </span>
          <Link
            href={`/auditor?flag=${tab}&page=${page + 1}`}
            aria-disabled={page * pageSize >= total}
            className={`flex items-center gap-1 text-sm font-medium ${
              page * pageSize >= total ? "pointer-events-none text-ink-subtle" : "text-ink-muted hover:text-ink"
            }`}
          >
            ถัดไป
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </AuditorPageShell>
  );
}
