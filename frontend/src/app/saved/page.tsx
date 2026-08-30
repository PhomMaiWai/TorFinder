"use client";

import { Bookmark, Building2, Clock, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-sidebar";
import { PageBody, PageHeader } from "@/components/layout/app-page";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { OPPORTUNITIES } from "@/data/opportunities";
import { useSavedTors, type SavedTorsScope } from "@/lib/use-saved-tors";

function SavedList({
  scope,
  showHeader = true,
}: {
  scope: SavedTorsScope;
  showHeader?: boolean;
}) {
  const { savedIds, toggleSaved } = useSavedTors(scope);
  const savedTors = OPPORTUNITIES.filter((o) => savedIds.includes(o.id));

  return (
    <>
      {showHeader && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            รายการที่บันทึกไว้
          </h1>
          <p className="mt-2 text-[15px] text-zinc-500">
            TOR ที่คุณบันทึกไว้เพื่อติดตามภายหลัง
          </p>
        </div>
      )}

      {savedTors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-transparent py-24 text-center">
          <Bookmark size={32} className="mx-auto mb-4 text-zinc-300" />
          <h3 className="text-base font-semibold text-zinc-900">ยังไม่มีรายการที่บันทึกไว้</h3>
          <p className="mt-1 text-[15px] text-zinc-500">
            กดไอคอนบันทึกที่การ์ด TOR ในหน้าค้นหาเพื่อบันทึกไว้ที่นี่
          </p>
          <Link
            href="/public"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            ไปหน้าค้นหา TOR
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {savedTors.map((tor) => (
            <article
              key={tor.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6"
            >
              <div className="min-w-0 flex-1">
                <Link href={`/tor/${tor.id}`} className="block">
                  <h3 className="text-base font-bold text-zinc-900 hover:text-accent sm:text-lg">
                    {tor.title}
                  </h3>
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px] text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={15} className="text-zinc-400" />
                    {tor.agency}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={15} className="text-zinc-400" />
                    เหลือ {tor.daysLeft} วัน
                  </span>
                  <span className="font-semibold text-zinc-900">{tor.budget}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/tor/${tor.id}`}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800"
                >
                  ดูรายละเอียด
                </Link>
                <button
                  onClick={() => toggleSaved(tor.id)}
                  aria-label="เอาออกจากรายการที่บันทึก"
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-danger"
                >
                  <X size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function SavedContent() {
  const params = useSearchParams();
  const scope: SavedTorsScope = params.get("scope") === "org" ? "org" : "public";

  if (scope === "org") {
    return (
      <AppShell>
        <PageHeader
          title="รายการที่บันทึก"
          description="TOR ที่คุณบันทึกไว้เพื่อติดตามภายหลัง"
        />
        <PageBody>
          <SavedList scope="org" showHeader={false} />
        </PageBody>
      </AppShell>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <SiteNavbar />
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-4xl px-6 sm:px-8">
          <SavedList scope="public" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function SavedPage() {
  return (
    <Suspense>
      <SavedContent />
    </Suspense>
  );
}
