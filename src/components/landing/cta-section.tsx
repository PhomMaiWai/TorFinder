import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CtaSection() {
  return (
    <section className="bg-ink py-20 sm:py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          พร้อมเริ่มต้นแล้วหรือยัง?
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink-subtle">
          เข้าร่วมกับบริษัทซอฟต์แวร์ที่ใช้ Torr
          และไม่พลาดโอกาสจัดซื้อจัดจ้าง BMA อีกต่อไป
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-7 text-sm font-bold text-ink transition-colors hover:bg-surface-alt"
        >
          เริ่มต้นฟรีวันนี้
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
