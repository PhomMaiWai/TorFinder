import { useTranslations } from "next-intl";

const FOOTER_GROUPS = [
  { headingKey: "productsHeading", linksKey: "productsLinks" },
  { headingKey: "forBuyersHeading", linksKey: "forBuyersLinks" },
  { headingKey: "companyHeading", linksKey: "companyLinks" },
] as const;

export function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="border-t border-border bg-surface-alt">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 text-base font-bold text-ink">
              <span className="flex size-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
                T
              </span>
              TorFinder
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              {t("descriptionLine1")}
              <br />
              {t("descriptionLine2")}
            </p>
          </div>

          {FOOTER_GROUPS.map(({ headingKey, linksKey }) => {
            const links = t.raw(linksKey) as string[];
            return (
              <div key={headingKey}>
                <h4 className="mb-3 text-sm font-semibold text-ink">
                  {t(headingKey)}
                </h4>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-ink-muted transition-colors hover:text-ink"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-sm text-ink-subtle sm:flex-row sm:items-center">
          <span>{t("copyright")}</span>
          <span>{t("demoNote")}</span>
        </div>
      </div>
    </footer>
  );
}
