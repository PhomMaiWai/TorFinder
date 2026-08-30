import { Building2, ChevronRight, ShieldAlert } from "lucide-react";
import Link from "next/link";

const ROLES = [
  {
    href: "/login/organization",
    icon: Building2,
    title: "เข้าสู่ระบบสำหรับหน่วยงาน",
    description: "สำหรับบริษัทและหน่วยงานที่ติดตามและเสนอราคา TOR",
  },
  {
    href: "/login/admin",
    icon: ShieldAlert,
    title: "เข้าสู่ระบบผู้ดูแลระบบ",
    description: "สำหรับผู้ดูแลระบบ TorFinder เท่านั้น",
  },
];

export default function LoginChoicePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt px-6 py-12">
      <div className="w-full max-w-xl">
        <Link href="/" className="mb-10 flex items-center justify-center gap-2.5">
          <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-base font-bold text-white">
            T
          </span>
          <span className="text-xl font-bold tracking-tight text-ink">TorFinder</span>
        </Link>

        <h1 className="mb-2 text-center text-3xl font-bold text-ink">เข้าสู่ระบบ</h1>
        <p className="mb-10 text-center text-base text-ink-muted">
          เลือกประเภทบัญชีที่ต้องการเข้าสู่ระบบ
        </p>

        <div className="space-y-4">
          {ROLES.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-5 rounded-2xl border border-border bg-white p-6 transition-colors hover:border-accent/40"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-surface-alt">
                <Icon size={24} className="text-ink-muted" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-ink">{title}</p>
                <p className="mt-1 text-sm text-ink-muted">{description}</p>
              </div>    
              <ChevronRight
                size={20}
                className="shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
