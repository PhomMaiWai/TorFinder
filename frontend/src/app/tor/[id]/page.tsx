import {
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  FileText,
  ListChecks,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { SaveTorButton } from "@/components/public/save-tor-button";
import { TOR_DETAILS } from "@/data/tor-details";
import { isKnown, stageBadgeCls } from "@/lib/tor-ui";
import { getTorById, mockNumericId } from "@/lib/tor-source";

function thaiDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "ไม่ระบุ";
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

export default async function TorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tor = await getTorById(id);
  if (!tor) notFound();

  const hasDeadline = isKnown(tor.deadline);
  // Showcase records carry hand-written scope/qualification detail; imported
  // announcements don't, so those sections simply don't render for them.
  const numericId = mockNumericId(id);
  const detail = numericId === null ? null : TOR_DETAILS.find((d) => d.id === numericId);
  const sourceUrl = tor.sourceUrl ?? detail?.sourceUrl;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <SiteNavbar />

      <main className="flex-1 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
          <Link
            href="/public"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ArrowLeft size={16} />
            กลับไปค้นหา TOR
          </Link>

          <div className="mb-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${stageBadgeCls(tor.stage)}`}
              >
                {tor.stage}
              </span>
              {tor.sourceRef && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                  ข้อมูลจากระบบ e-GP
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold leading-snug tracking-tight text-zinc-950 sm:text-[28px]">
                  {tor.title}
                </h1>
                <p className="mt-2.5 flex items-center gap-1.5 text-[15px] text-zinc-500">
                  <Building2 size={16} className="text-zinc-400" />
                  {tor.agency}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <SaveTorButton torId={tor.id} />
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark"
                  >
                    <ExternalLink size={15} />
                    ดูต้นฉบับ e-GP
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-zinc-900">
                  <FileText size={18} className="text-zinc-400" />
                  รายละเอียดประกาศ
                </h2>
                <p className="text-[15px] leading-relaxed text-zinc-600">{tor.summary}</p>

                {!detail && sourceUrl && (
                  <p className="mt-4 border-t border-zinc-100 pt-4 text-sm text-zinc-500">
                    ขอบเขตงาน คุณสมบัติผู้เสนอ และกำหนดการยื่นข้อเสนอ อยู่ในเอกสารประกาศฉบับเต็ม{" "}
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent hover:text-accent-dark"
                    >
                      เปิดเอกสาร
                    </a>
                  </p>
                )}
              </div>

              {detail && (
                <>
                  <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-zinc-900">
                      <FileText size={18} className="text-zinc-400" />
                      ขอบเขตงาน
                    </h2>
                    <p className="text-[15px] leading-relaxed text-zinc-600">{detail.scope}</p>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900">
                      <Shield size={18} className="text-zinc-400" />
                      คุณสมบัติผู้เสนอ
                    </h2>
                    <ul className="space-y-3">
                      {detail.qualifications.map((q) => (
                        <li
                          key={q}
                          className="flex items-start gap-2.5 text-[15px] leading-relaxed text-zinc-600"
                        >
                          <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900">
                      <ListChecks size={18} className="text-zinc-400" />
                      สิ่งที่ต้องส่งมอบ
                    </h2>
                    <ol className="space-y-2.5">
                      {detail.deliverables.map((d, i) => (
                        <li key={d} className="flex items-center gap-3 text-[15px] text-zinc-600">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                            {i + 1}
                          </span>
                          {d}
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}

              {tor.tags.length > 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-3 text-lg font-bold text-zinc-900">วิธีจัดหา / หมวดหมู่</h2>
                  <div className="flex flex-wrap gap-2">
                    {tor.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <InfoRow
                  icon={Banknote}
                  label="งบประมาณโครงการ"
                  value={tor.budget}
                  muted={!isKnown(tor.budget)}
                />
                <InfoRow
                  icon={Clock}
                  label="วันที่ปิดรับ"
                  value={hasDeadline ? tor.deadline : "ไม่ระบุ"}
                  muted={!hasDeadline}
                />
                <InfoRow
                  icon={Calendar}
                  label="วันที่ประกาศ"
                  value={detail?.publishedAt ?? thaiDate(tor.createdAt)}
                />
              </div>
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  muted = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-zinc-100 py-3 last:border-0 last:pb-0 first:pt-0">
      <Icon size={16} className="mt-0.5 shrink-0 text-zinc-400" />
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={`mt-0.5 text-sm font-semibold ${muted ? "text-zinc-400" : "text-zinc-900"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
