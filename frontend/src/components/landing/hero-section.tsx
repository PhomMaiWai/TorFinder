import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt px-4 py-1.5 text-sm font-medium text-ink-muted">
          <Zap size={14} className="text-accent" />
          สำหรับบริษัทซอฟต์แวร์ในไทย
        </div>

        <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight text-ink sm:text-6xl lg:text-7xl">
          ไม่พลาดโอกาส
          <br />
          <span className="text-accent">จัดซื้อซอฟต์แวร์ BMA</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
          รวบรวม วิเคราะห์ และจับคู่ TOR จากหน่วยงาน กทม.
          กับบริษัทของคุณโดยอัตโนมัติ ไม่ต้องตรวจสอบ e-GP ทุกวันอีกต่อไป
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-11 items-center gap-2 rounded-lg bg-accent px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark"
          >
            เริ่มต้นฟรี
            <ArrowRight size={16} />
          </Link>
          <Link
            href="#preview"
            className="flex h-11 items-center rounded-lg border border-border px-6 text-sm font-semibold text-ink transition-colors hover:bg-surface-alt"
          >
            ดูตัวอย่าง
          </Link>
        </div>

        {/* <p className="mt-5 text-sm text-ink-subtle">
          ✓ ไม่ต้องใช้บัตรเครดิต &nbsp;·&nbsp; ✓ เริ่มใช้งานได้ทันที
        </p> */}
      </div>
    </section>
  );
}
