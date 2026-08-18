"use client";

import {
  ArrowLeft,
  ChevronDown,
  LayoutDashboard,
  Menu,
  Search,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavLink = {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
};

const NAV: { section: string | null; links: NavLink[] }[] = [
  {
    section: null,
    links: [
      { label: "ภาพรวม", href: "/dashboard", icon: LayoutDashboard },
      { label: "ค้นหา TOR", href: "/public", icon: Search },
    ],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3" aria-label="เมนูหลัก">
      {NAV.map(({ section, links }, i) => (
        <div key={i} className={i > 0 ? "mt-5" : ""}>
          {section && (
            <p className="mb-1 px-2.5 text-[11px] font-medium text-ink-subtle">{section}</p>
          )}
          <ul className="space-y-0.5">
            {links.map(({ label, href, icon: Icon, badge }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      active
                        ? "bg-zinc-200/70 font-semibold text-ink"
                        : "font-medium text-ink-muted hover:bg-zinc-100 hover:text-ink"
                    }`}
                  >
                    <Icon size={16} className="shrink-0 opacity-70" />
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <span className="flex items-center gap-0.5 rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                        <ShieldAlert size={9} />
                        {badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#f5f5f4]">
      {/* Workspace */}
      <div className="px-3 pt-4 pb-2">
        <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-zinc-200/50">
          <span className="flex size-7 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-white">
            T
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink">
            Arun Digital
          </span>
          <ChevronDown size={14} className="shrink-0 text-ink-subtle" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-sm text-ink-subtle shadow-sm">
          <Search size={14} />
          <span className="flex-1">ค้นหา...</span>
          <kbd className="rounded border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
            ⌘K
          </kbd>
        </div>
      </div>

      <NavLinks onNavigate={onNavigate} />

      {/* Back to landing */}
      <div className="px-3 pb-2">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-zinc-100 hover:text-ink"
        >
          <ArrowLeft size={15} className="opacity-60" />
          กลับหน้าหลัก
        </Link>
      </div>

      {/* User */}
      <div className="shrink-0 border-t border-zinc-200/80 p-3">
        <button className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-zinc-200/50">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-zinc-600 ring-1 ring-zinc-200">
            A
          </span>
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-medium text-ink">Arun Digital</p>
            <p className="truncate text-xs text-ink-muted">Co., Ltd</p>
          </div>
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 border-r border-zinc-200/80 md:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px] border-r border-zinc-200/80 shadow-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-white">
              T
            </span>
            <span className="text-sm font-bold text-ink">Torr</span>
          </Link>
          <button
            className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-alt"
            onClick={() => setMobileOpen(true)}
            aria-label="เปิดเมนู"
          >
            <Menu size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
