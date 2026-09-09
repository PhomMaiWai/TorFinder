import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { TorSearch } from "@/components/public/tor-search";
import { getAllTors } from "@/lib/tor-source";

export default async function PublicPage() {
  const [tors, t] = await Promise.all([getAllTors(), getTranslations("PublicPage")]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <SiteNavbar />
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              {t("pageTitle")}
            </h1>
            <p className="mt-2 text-[15px] text-zinc-500">{t("pageDescription")}</p>
          </div>

          <TorSearch tors={tors} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
