"use client";

import { Building2, ShieldAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

const ICONS = {
  building: Building2,
  shield: ShieldAlert,
} as const satisfies Record<string, LucideIcon>;

type SignInIcon = keyof typeof ICONS;

type SignInFormProps = {
  icon: SignInIcon;
  badge: string;
  title: string;
  description: string;
  redirectTo: string;
  switchHref: string;
  switchLabel: string;
  signupHref?: string;
  signupLabel?: string;
  tone?: "accent" | "danger";
};

export function SignInForm({
  icon,
  badge,
  title,
  description,
  redirectTo,
  switchHref,
  switchLabel,
  signupHref,
  signupLabel,
  tone = "accent",
}: SignInFormProps) {
  const router = useRouter();
  const Icon = ICONS[icon];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const badgeCls =
    tone === "danger" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-text";
  const buttonCls =
    tone === "danger"
      ? "bg-danger hover:bg-danger/90"
      : "bg-accent hover:bg-accent-dark";

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(redirectTo);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt px-6 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-10 flex items-center justify-center gap-2.5">
          <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-base font-bold text-white">
            T
          </span>
          <span className="text-xl font-bold tracking-tight text-ink">TorFinder</span>
        </Link>

        <div className="rounded-2xl border border-border bg-white p-10">
          <span
            className={`mb-4 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${badgeCls}`}
          >
            <Icon size={15} />
            {badge}
          </span>
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          <p className="mt-1.5 text-base text-ink-muted">{description}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">อีเมล</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-12 w-full rounded-lg border border-border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">รหัสผ่าน</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 w-full rounded-lg border border-border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
              />
            </label>

            <button
              type="submit"
              className={`flex h-12 w-full items-center justify-center rounded-lg text-base font-semibold text-white transition-colors ${buttonCls}`}
            >
              เข้าสู่ระบบ
            </button>
          </form>
        </div>

        {signupHref && signupLabel && (
          <p className="mt-6 text-center text-sm text-ink-muted">
            ยังไม่มีบัญชี?{" "}
            <Link href={signupHref} className="font-medium text-accent hover:text-accent-dark">
              {signupLabel}
            </Link>
          </p>
        )}

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link href="/login" className="font-medium text-ink-muted hover:text-ink">
            ← เลือกประเภทบัญชีอื่น
          </Link>
          <Link href={switchHref} className="font-medium text-accent hover:text-accent-dark">
            {switchLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
