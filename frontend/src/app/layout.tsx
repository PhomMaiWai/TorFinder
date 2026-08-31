import type { Metadata } from "next";
import { Geist, Noto_Sans_Thai } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "TorFinder — ค้นหา TOR ซอฟต์แวร์ BMA",
  description:
    "แพลตฟอร์มรวบรวม วิเคราะห์ และจับคู่ประกาศ TOR ด้านซอฟต์แวร์ของกรุงเทพมหานคร",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${notoSansThai.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
