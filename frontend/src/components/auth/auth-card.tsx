import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** The logo, one card and the way back — the frame every sign-in side page shares. */
export function AuthCard({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const tc = useTranslations("Common");

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-10 flex items-center justify-center gap-2.5">
          <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-base font-bold text-white">
            T
          </span>
          <span className="text-xl font-bold tracking-tight text-ink">TorFinder</span>
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-8 sm:p-10">{children}</div>

        <div className="mt-6 flex flex-col items-center gap-3">
          {footer}
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={15} />
            {tc("backToHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}

/** A round icon over a title and a line of explanation, for a page's outcome. */
export function AuthStatus({
  icon,
  tone,
  title,
  children,
}: {
  icon: React.ReactNode;
  tone: "success" | "warn" | "danger" | "accent";
  title: string;
  children?: React.ReactNode;
}) {
  const toneCls = {
    success: "bg-success-soft text-success",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    accent: "bg-accent-soft text-accent",
  }[tone];

  return (
    <div className="text-center">
      <span className={`mx-auto mb-4 flex size-14 items-center justify-center rounded-full ${toneCls}`}>{icon}</span>
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      {children && <div className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</div>}
    </div>
  );
}
