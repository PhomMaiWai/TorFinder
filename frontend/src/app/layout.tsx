import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import "./globals.css";

import { ThemeProvider } from "@/lib/theme-context";

/**
 * Applied before React hydrates, so a viewer who chose dark mode never sees a
 * flash of the light theme while the bundle loads.
 */
const THEME_INIT_SCRIPT = `
  try {
    if (localStorage.getItem("torr:theme") === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
`;

/**
 * Fonts are served from the repo rather than `next/font/google`, whose
 * build-time fetch made Turbopack builds fail intermittently. Both files are
 * the Google Fonts variable fonts subset to what Google served before: Geist
 * for latin, latin-ext, cyrillic and vietnamese; Noto Sans Thai for thai,
 * latin and latin-ext at weights 400–700. Licences sit beside them (OFL).
 */
const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const notoSansThai = localFont({
  src: "./fonts/NotoSansThai-Variable.woff2",
  variable: "--font-noto-thai",
  weight: "400 700",
});

/**
 * Namespaces read by client components. Server components translate on the
 * server, so shipping their strings too would put every page's copy — the
 * landing page's and the TOR detail's included — into every page's HTML.
 * A new `useTranslations("X")` in a client component needs X added here.
 */
const CLIENT_NAMESPACES = [
  "AccountLinks",
  "AdminAccountsPage",
  "AdminCompaniesPage",
  "AdminUsersPage",
  "AppShell",
  "Bidding",
  "Common",
  "CompanyProfileOptions",
  "Dashboard",
  "ErrorState",
  // SiteFooter renders inside client trees too: the error boundary and /saved.
  "Footer",
  "LandingExplorer",
  "LandingHeroFlow",
  "GoogleCompleteSignupForm",
  "LandingPreview",
  "Navbar",
  "NotificationsPage",
  "Overview",
  "OwnerPage",
  "ProfilePage",
  "ProposalDraft",
  "PublicPage",
  "ReportProblem",
  "SavedPage",
  "SignInForm",
  "SignupOrganizationPage",
  "SignupPendingPage",
  "TorDocuments",
  "ViewerSignIn",
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const allMessages = await getMessages();
  const messages = Object.fromEntries(
    CLIENT_NAMESPACES.filter((ns) => ns in allMessages).map((ns) => [ns, allMessages[ns]]),
  );

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${notoSansThai.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
