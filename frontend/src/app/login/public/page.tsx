import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { ViewerSignIn } from "@/components/auth/viewer-sign-in";

export default function PublicLoginPage() {
  const t = useTranslations("LoginPublicPage");
  const tf = useTranslations("SignInForm");
  const tc = useTranslations("Common");

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt px-6 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-10 flex items-center justify-center gap-2.5">
          <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-base font-bold text-white">
            T
          </span>
          <span className="text-xl font-bold tracking-tight text-ink">TorFinder</span>
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-10">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent-text">
            <Users size={15} />
            {t("badge")}
          </span>
          <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>
          <p className="mt-1.5 text-base text-ink-muted">{t("description")}</p>

          <ViewerSignIn />
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/login" className="font-medium text-ink-muted hover:text-ink">
            {tf("chooseOtherAccountType")}
          </Link>
          <Link href="/login/organization" className="font-medium text-accent hover:text-accent-dark">
            {t("switchLabel")}
          </Link>
        </div>

        <Link
          href="/"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} />
          {tc("backToHome")}
        </Link>
      </div>
    </main>
  );
}
