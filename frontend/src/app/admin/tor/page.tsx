import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";

import { DeleteTorButton } from "@/components/admin/delete-tor-button";
import { AdminPageShell } from "@/components/layout/admin-page";
import { fetchDeletedTors } from "@/lib/tor-admin-api";
import { fetchTorList } from "@/lib/tor-api";
import { stageBadgeCls } from "@/lib/tor-ui";

import { syncFromEgp } from "./actions";

const PAGE_SIZE = 20;

const TABS = [
  { id: "manual", label: "สร้างเอง" },
  { id: "egp", label: "จาก e-GP" },
  { id: "all", label: "ทั้งหมด" },
  { id: "deleted", label: "ถังขยะ" },
] as const;

const DELETE_LABELS = {
  delete: "ลบ",
  confirm: "ยืนยันลบ?",
  cancel: "ยกเลิก",
  restore: "กู้คืน",
};

export default async function AdminTorListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; source?: string }>;
}) {
  const { page: pageParam, source: sourceParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const source =
    sourceParam === "egp" || sourceParam === "all" || sourceParam === "deleted"
      ? sourceParam
      : "manual";

  // The trash has its own guarded route; the rest of the tabs are one listing
  // with a source filter.
  const isTrash = source === "deleted";
  const tors = isTrash
    ? await fetchDeletedTors()
    : await fetchTorList(page, PAGE_SIZE, source === "all" ? undefined : source);

  return (
    <AdminPageShell title="รายการ TOR" description="รายการ TOR ทั้งหมดในระบบ">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg border border-border bg-white p-1">
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                href={`/admin/tor?source=${tab.id}`}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  source === tab.id
                    ? "bg-ink text-white"
                    : "text-ink-muted hover:bg-surface-alt hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-3">
          <form action={syncFromEgp}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-alt"
            >
              <RefreshCw size={16} />
              ดึงประกาศจาก e-GP
            </button>
          </form>
          <Link
            href="/admin/tor/new"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            <Plus size={16} />
            เพิ่มรายการ TOR
          </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {tors.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">
              {isTrash ? "ถังขยะว่าง" : "ยังไม่มีรายการ TOR"}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-alt text-left text-xs text-ink-muted">
                  <th className="px-5 py-3 font-medium">ชื่อโครงการ</th>
                  <th className="px-5 py-3 font-medium">หน่วยงาน</th>
                  <th className="px-5 py-3 font-medium">สถานะ</th>
                  <th className="px-5 py-3 font-medium">วันที่ปิดรับ</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {tors.map((tor) => (
                  <tr key={tor.id} className="border-b border-border last:border-0">
                    <td className="max-w-xs truncate px-5 py-3 font-medium text-ink">{tor.title}</td>
                    <td className="px-5 py-3 text-ink-muted">{tor.agency}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${stageBadgeCls(tor.stage)}`}
                      >
                        {tor.stage}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{tor.deadline}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-4">
                        <Link
                          href={`/admin/tor/${tor.id}`}
                          className="font-medium text-accent hover:text-accent-dark"
                        >
                          ดูรายละเอียด
                        </Link>
                        <DeleteTorButton
                          torId={tor.id}
                          deleted={isTrash}
                          labels={DELETE_LABELS}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={`flex items-center justify-between ${isTrash ? "hidden" : ""}`}>
          <Link
            href={`/admin/tor?source=${source}&page=${Math.max(1, page - 1)}`}
            aria-disabled={page <= 1}
            className={`flex items-center gap-1 text-sm font-medium ${
              page <= 1 ? "pointer-events-none text-ink-subtle" : "text-ink-muted hover:text-ink"
            }`}
          >
            <ChevronLeft size={16} />
            ก่อนหน้า
          </Link>
          <span className="text-sm text-ink-muted">หน้า {page}</span>
          <Link
            href={`/admin/tor?source=${source}&page=${page + 1}`}
            aria-disabled={tors.length < PAGE_SIZE}
            className={`flex items-center gap-1 text-sm font-medium ${
              tors.length < PAGE_SIZE ? "pointer-events-none text-ink-subtle" : "text-ink-muted hover:text-ink"
            }`}
          >
            ถัดไป
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </AdminPageShell>
  );
}
