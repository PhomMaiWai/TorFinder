import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/layout/admin-page";
import { fetchTor } from "@/lib/tor-api";
import { stageBadgeCls } from "@/lib/tor-ui";

export default async function AdminTorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tor = await fetchTor(id);
  if (!tor) notFound();

  return (
    <AdminPageShell title="รายละเอียด TOR" description={tor.agency}>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/tor"
            className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
          >
            <ArrowLeft size={16} />
            กลับไปรายการ TOR
          </Link>
          <Link
            href={`/admin/tor/${tor.id}/edit`}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            <Pencil size={14} />
            แก้ไข
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-white p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${stageBadgeCls(tor.stage)}`}
            >
              {tor.stage}
            </span>
            {tor.sourceRef && (
              <span className="rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
                นำเข้าจากระบบ e-GP
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-ink">{tor.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{tor.agency}</p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="งบประมาณ" value={tor.budget} />
            <Stat label="วันที่ปิดรับ" value={tor.deadline} />
            <Stat label="วันที่เหลือ" value={`${tor.daysLeft} วัน`} />
            <Stat label="สถานะงบประมาณ" value={tor.budgetStatus ?? "ปกติ"} />
          </div>

          {tor.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {tor.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-surface-alt px-2.5 py-1 text-xs font-medium text-ink-muted">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 border-t border-border pt-6">
            <h2 className="mb-2 text-sm font-bold text-ink">รายละเอียดโดยย่อ</h2>
            <p className="text-sm leading-relaxed text-ink-muted">{tor.summary}</p>

            {tor.sourceUrl && (
              <a
                href={tor.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-dark"
              >
                <ExternalLink size={14} />
                เปิดเอกสารประกาศฉบับเต็ม (e-GP)
              </a>
            )}
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
