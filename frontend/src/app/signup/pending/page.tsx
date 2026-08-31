"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PendingCard() {
  const params = useSearchParams();
  const name = params.get("name") ?? "บริษัทของคุณ";

  return (
    <div className="w-full max-w-md text-center">
      <Link href="/" className="mb-10 flex items-center justify-center gap-2.5">
        <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-base font-bold text-white">
          T
        </span>
        <span className="text-xl font-bold tracking-tight text-ink">TorFinder</span>
      </Link>

      <div className="rounded-2xl border border-border bg-white p-10">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-warn-soft">
          <Clock size={26} className="text-warn" />
        </span>
        <h1 className="text-xl font-bold text-ink">รอการอนุมัติจากผู้ดูแลระบบ</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          บัญชีของ <span className="font-medium text-ink">{name}</span> ถูกส่งเรียบร้อยแล้ว
          ทีมผู้ดูแลระบบจะตรวจสอบข้อมูลและแจ้งผลผ่านอีเมลภายใน 1-2 วันทำการ
        </p>
      </div>

      <Link
        href="/login"
        className="mt-6 inline-block text-sm font-medium text-accent hover:text-accent-dark"
      >
        ← กลับหน้าเข้าสู่ระบบ
      </Link>
    </div>
  );
}

export default function SignupPendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt px-6 py-12">
      <Suspense>
        <PendingCard />
      </Suspense>
    </main>
  );
}
