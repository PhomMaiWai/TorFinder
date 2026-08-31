"use client";

import { Bell, Bookmark, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PUBLIC_NOTICES } from "@/data/public-notices";
import { useSavedTors } from "@/lib/use-saved-tors";

const NAV_LINKS = [
  { label: "ค้นหา TOR", href: "/public" },
  { label: "วิธีการทำงาน", href: "#how-it-works" },
];

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onOutside]);

  return ref;
}

export function SiteNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const { savedIds } = useSavedTors();

  const noticesRef = useClickOutside(() => setNoticesOpen(false));

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="TorFinder">
          <span className="flex size-7 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-white">
            T
          </span>
          <span className="text-sm font-bold tracking-tight text-ink">TorFinder</span>
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

        <div className="flex items-center gap-1.5">
          <Link
            href="/saved"
            className="relative grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
            aria-label="รายการที่บันทึกไว้"
          >
            <Bookmark size={17} />
            {savedIds.length > 0 && (
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                {savedIds.length}
              </span>
            )}
          </Link>

          <div className="relative" ref={noticesRef}>
            <button
              onClick={() => setNoticesOpen((v) => !v)}
              className="relative grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
              aria-label="การแจ้งเตือน"
            >
              <Bell size={17} />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" />
            </button>

            {noticesOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-white p-2 shadow-lg">
                <p className="px-2.5 py-1.5 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
                  ประกาศล่าสุด
                </p>
                <ul className="space-y-0.5">
                  {PUBLIC_NOTICES.map((n) => (
                    <li key={n.id} className="rounded-lg px-2.5 py-2 hover:bg-surface-alt">
                      <p className="text-sm text-ink">{n.message}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">{n.time}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Link
            href="/login"
            className="hidden px-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink md:block"
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
            <Link href="/login" className="flex-1 py-2 text-center text-sm text-ink-muted">
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
