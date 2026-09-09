import type { Metadata } from "next";
import { Geist, Noto_Sans_Thai } from "next/font/google";
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
});

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
  const messages = await getMessages();

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
