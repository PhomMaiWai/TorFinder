"use client";

import { ArrowRight, Bell, Bookmark, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";

import { PUBLIC_NOTICES } from "@/data/public-notices";
import { useSavedTors } from "@/lib/use-saved-tors";
import { homeFor, useSession } from "@/lib/use-session";

/** Landing-page sections the navbar links to and tracks while scrolling. */
const SECTION_IDS = ["features", "how-it-works", "preview"] as const;
/** How far down the page before the bar turns into a glass pill. */
const SCROLLED_AT = 12;

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

/** Glass state on scroll, plus a reading-progress bar written straight to the DOM. */
function useScrollState() {
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(window.scrollY > SCROLLED_AT);
      progressRef.current?.style.setProperty("transform", `scaleX(${max > 0 ? window.scrollY / max : 0})`);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return { scrolled, progressRef };
}

/** The landing section currently crossing the middle of the screen. */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // Entries only report changes, so track who is in the band; none means
    // the hero or an unlinked section, and nothing should stay highlighted.
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        setActive(SECTION_IDS.find((id) => inBand.has(id)) ?? null);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const id of SECTION_IDS) {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [enabled]);

  return enabled ? active : null;
}

export function SiteNavbar() {
  const t = useTranslations("Navbar");
  const pathname = usePathname();
  const session = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [pill, setPill] = useState({ left: 0, width: 0, visible: false });
  const { savedIds } = useSavedTors();
  const { scrolled, progressRef } = useScrollState();
  const isLanding = pathname === "/";
  const activeSection = useActiveSection(isLanding);
  // /saved needs an account, so a guest's bookmark would only bounce to login.
  const showUserTools = !isLanding && Boolean(session);

  const noticesRef = useClickOutside(() => setNoticesOpen(false));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setNoticesOpen(false);
      setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const navLinks = [
    { label: t("navSearch"), href: "/public", active: pathname.startsWith("/public") },
    { label: t("navFeatures"), href: "/#features", active: activeSection === "features" },
    { label: t("navHowItWorks"), href: "/#how-it-works", active: activeSection === "how-it-works" },
    { label: t("navPreview"), href: "/#preview", active: activeSection === "preview" },
  ];

  // The hover pill slides between links instead of each link lighting up on its own.
  function movePill(event: { currentTarget: HTMLAnchorElement }) {
    const { offsetLeft, offsetWidth } = event.currentTarget;
    setPill({ left: offsetLeft, width: offsetWidth, visible: true });
  }

  const solid = scrolled || mobileOpen;

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4">
      <div
        className={`relative mx-auto rounded-2xl transition-[max-width,background-color,box-shadow,border-color] duration-500 ease-out ${
          solid ? "glass-strong max-w-5xl" : "max-w-6xl border border-transparent"
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 px-3 transition-[height] duration-500 ease-out sm:px-4 ${
            solid ? "h-14" : "h-16"
          }`}
        >
          <Link href="/" className="group flex items-center gap-2.5" aria-label="TorFinder">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-accent-dark text-xs font-bold text-white shadow-glow transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
              T
            </span>
            <span className="text-base font-bold tracking-tight text-ink">TorFinder</span>
          </Link>

          <nav
            className="relative hidden items-center lg:flex"
            onMouseLeave={() => setPill((p) => ({ ...p, visible: false }))}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 rounded-lg bg-surface-alt transition-all duration-300 ease-out"
              style={{ left: pill.left, width: pill.width, opacity: pill.visible ? 1 : 0 }}
            />
            {navLinks.map(({ label, href, active }) => (
              <Link
                key={href}
                href={href}
                onMouseEnter={movePill}
                onFocus={movePill}
                aria-current={active ? "location" : undefined}
                className={`relative px-3.5 py-2 text-sm transition-colors duration-200 ${
                  active ? "font-semibold text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {label}
                <span
                  aria-hidden
                  className={`absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent transition-transform duration-300 ${
                    active ? "scale-100" : "scale-0"
                  }`}
                />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-surface-alt/60 p-0.5">
              <LanguageToggle />
              <ThemeToggle />
            </div>

            {/* Signed-in users only, and not on the landing page, which is for
                deciding to sign up. */}
            {showUserTools && (
              <>
                <Link
                  href="/saved"
                  className="relative grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
                  aria-label={t("savedAriaLabel")}
                >
                  <Bookmark size={17} />
                  {savedIds.length > 0 && (
                    <span
                      key={savedIds.length}
                      className="animate-pop-in absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-2xs font-bold text-white ring-2 ring-surface"
                    >
                      {savedIds.length}
                    </span>
                  )}
                </Link>

                <div className="relative" ref={noticesRef}>
                  <button
                    type="button"
                    onClick={() => setNoticesOpen((v) => !v)}
                    className={`group relative grid size-9 place-items-center rounded-lg transition-colors hover:bg-surface-alt hover:text-ink ${
                      noticesOpen ? "bg-surface-alt text-ink" : "text-ink-muted"
                    }`}
                    aria-label={t("notificationsAriaLabel")}
                    aria-expanded={noticesOpen}
                  >
                    <Bell size={17} className="origin-top group-hover:animate-bell" />
                    <span className="absolute right-2 top-2 flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/60" />
                      <span className="relative inline-flex size-2 rounded-full bg-accent ring-2 ring-surface" />
                    </span>
                  </button>

                  {noticesOpen && (
                    <div className="animate-pop-in absolute right-0 top-full mt-3 w-80 origin-top-right rounded-2xl border border-border/70 bg-surface/95 p-2 shadow-[0_16px_40px_-12px_rgb(0_0_0/20%)] backdrop-blur-xl">
                      <div className="flex items-center justify-between px-2.5 py-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t("recentNotices")}</p>
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-semibold text-accent">
                          {t("noticesCount", { count: PUBLIC_NOTICES.length })}
                        </span>
                      </div>
                      <ul className="space-y-0.5">
                        {PUBLIC_NOTICES.map((n) => (
                          <li key={n.id} className="flex gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface-alt/80">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                            <div>
                              <p className="text-sm text-ink">{n.message}</p>
                              <p className="mt-0.5 text-xs text-ink-subtle">{n.time}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}

            <span aria-hidden className="mx-1.5 hidden h-6 w-px bg-border md:block" />

            {session === undefined ? (
              <span className="hidden h-9 w-40 animate-pulse rounded-xl bg-surface-alt md:block" />
            ) : session ? (
              <Link
                href={homeFor(session.role)}
                className="group hidden h-9 max-w-52 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:-translate-y-px hover:bg-accent-dark md:flex"
              >
                <span className="truncate">{session.name}</span>
                <ArrowRight size={14} className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login/organization"
                  className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink md:block"
                >
                  {t("login")}
                </Link>
                <Link
                  href="/signup/organization"
                  className="group hidden h-9 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:-translate-y-px hover:bg-accent-dark md:flex"
                >
                  {t("getStarted")}
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </>
            )}

            <button
              type="button"
              className="relative grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? t("closeMenuAriaLabel") : t("openMenuAriaLabel")}
              aria-expanded={mobileOpen}
            >
              <Menu
                size={19}
                className={`absolute transition-all duration-300 ${mobileOpen ? "rotate-90 scale-50 opacity-0" : ""}`}
              />
              <X
                size={19}
                className={`absolute transition-all duration-300 ${mobileOpen ? "" : "-rotate-90 scale-50 opacity-0"}`}
              />
            </button>
          </div>
        </div>

        {/* Mobile menu: grid rows 0fr → 1fr animates the height without measuring it */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out lg:hidden ${
            mobileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
          inert={!mobileOpen}
        >
          <div className="overflow-hidden">
            <nav className="border-t border-border/60 px-3 pb-3 pt-2">
              {navLinks.map(({ label, href, active }, i) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between rounded-lg px-3 py-3 text-sm transition-all duration-300 hover:bg-surface-alt ${
                    active ? "font-semibold text-ink" : "text-ink-muted"
                  } ${mobileOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
                  style={{ transitionDelay: mobileOpen ? `${60 + i * 40}ms` : "0ms" }}
                >
                  {label}
                  {active && <span className="size-1.5 rounded-full bg-accent" />}
                </Link>
              ))}
              <div className="mt-2 flex gap-2 border-t border-border/60 pt-3 md:hidden">
                {session ? (
                  <Link
                    href={homeFor(session.role)}
                    className="flex flex-1 items-center justify-center truncate rounded-xl bg-accent py-2.5 text-sm font-semibold text-white shadow-glow"
                  >
                    {session.name}
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login/organization"
                      className="flex-1 rounded-xl border border-border py-2.5 text-center text-sm font-medium text-ink"
                    >
                      {t("login")}
                    </Link>
                    <Link
                      href="/signup/organization"
                      className="flex flex-1 items-center justify-center rounded-xl bg-accent py-2.5 text-sm font-semibold text-white shadow-glow"
                    >
                      {t("getStarted")}
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>

        {/* Reading progress along the bottom edge, once the bar is a pill */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-4 bottom-0 h-0.5 overflow-hidden rounded-full transition-opacity duration-500 ${
            scrolled ? "opacity-100" : "opacity-0"
          }`}
        >
          <span
            ref={progressRef}
            className="block h-full origin-left scale-x-0 rounded-full bg-gradient-to-r from-rose-400 to-accent"
          />
        </span>
      </div>
    </header>
  );
}
