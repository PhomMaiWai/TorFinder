"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { label: "ค้นหา TOR", href: "/public" },
  { label: "วิธีการทำงาน", href: "#how-it-works" },
];

export function SiteNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Torr">
          <span className="flex size-7 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-white">
            T
          </span>
          <span className="text-sm font-bold tracking-tight text-ink">Torr</span>
        </Link>

        <nav className="hidden items-center md:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="px-3 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden text-sm font-medium text-ink-muted transition-colors hover:text-ink md:block"
          >
            เข้าสู่ระบบ
          </Link>
          <Link
            href="/dashboard"
            className="hidden h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-dark md:flex"
          >
            เริ่มต้นฟรี
          </Link>

          <button
            className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-alt md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "ปิดเมนู" : "เปิดเมนู"}
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border bg-white px-6 py-2 md:hidden">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm text-ink-muted hover:text-ink"
            >
              {label}
            </Link>
          ))}
          <div className="flex gap-3 border-t border-border py-3">
            <Link href="/dashboard" className="flex-1 py-2 text-center text-sm text-ink-muted">
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/dashboard"
              className="flex flex-1 items-center justify-center rounded-lg bg-accent py-2 text-sm font-semibold text-white"
            >
              เริ่มต้นฟรี
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
