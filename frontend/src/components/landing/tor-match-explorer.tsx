"use client";

import { Building2, CircleAlert, CircleCheck, Clock, FileText, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from "react";

type Status = "pass" | "fail";
type Requirement = { label: string; required: string; yours: string; status: Status; weight: number };

const STATUS_STYLE = {
  pass: { icon: CircleCheck, text: "text-success", chip: "bg-success-soft text-success" },
  fail: { icon: CircleAlert, text: "text-danger", chip: "bg-danger-soft text-danger" },
} as const;

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;
/** Arc length left blank between segments. */
const RING_GAP = 6;
const CYCLE_MS = 2800;

/** One arc per requirement, sized by its weight; the active one stands out. */
function SegmentedRing({ items, active, score }: { items: Requirement[]; active: number; score: number }) {
  const t = useTranslations("LandingExplorer");
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  // Where each arc starts: the summed share of every arc before it.
  const starts = items.map((_, i) =>
    items.slice(0, i).reduce((sum, item) => sum + (item.weight / total) * RING_C, 0),
  );

  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        {items.map((item, i) => {
          const length = (item.weight / total) * RING_C - RING_GAP;
          const dashOffset = -starts[i];
          const isActive = i === active;
          return (
            <circle
              key={item.label}
              cx="60"
              cy="60"
              r={RING_R}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${length} ${RING_C}`}
              strokeDashoffset={dashOffset}
              className={`transition-all duration-500 ${item.status === "pass" ? "stroke-accent" : "stroke-ink-subtle"}`}
              style={{ strokeWidth: isActive ? 11 : 7, opacity: isActive ? 1 : 0.35 }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums tracking-tight text-ink">{score}</span>
        <span className="text-xs font-medium text-ink-muted">{t("matchLabel")}</span>
      </div>
    </div>
  );
}

export function TorMatchExplorer() {
  const t = useTranslations("LandingExplorer");
  const items = t.raw("requirements") as Requirement[];
  const score = items.filter((item) => item.status === "pass").reduce((sum, item) => sum + item.weight, 0);

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Walk through the requirements on its own until the visitor takes over.
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % items.length), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [paused, items.length]);

  // Tilt + spotlight follow the mouse; touch and pen leave the card flat.
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card || event.pointerType !== "mouse") return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    card.style.setProperty("--mx", `${x * 100}%`);
    card.style.setProperty("--my", `${y * 100}%`);
    card.style.setProperty("--rx", `${(0.5 - y) * 8}deg`);
    card.style.setProperty("--ry", `${(x - 0.5) * 10}deg`);
  }

  function resetTilt() {
    cardRef.current?.style.setProperty("--rx", "0deg");
    cardRef.current?.style.setProperty("--ry", "0deg");
  }

  const current = items[active];

  return (
    <section className="aurora overflow-hidden bg-surface py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles size={13} />
            {t("eyebrow")}
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("heading")}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">{t("description")}</p>
        </div>

        <div
          className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {/* The TOR document */}
          <div className="[perspective:1200px]">
            <div
              ref={cardRef}
              onPointerMove={handlePointerMove}
              onPointerLeave={resetTilt}
              className="glass relative overflow-hidden rounded-2xl p-6 transition-transform duration-300 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] sm:p-8"
              style={{ "--mx": "50%", "--my": "0%" } as CSSProperties}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(420px_circle_at_var(--mx)_var(--my),color-mix(in_srgb,var(--color-accent)_12%,transparent),transparent_60%)]"
              />
              {/* AI scan line */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full">
                <div className="animate-scan absolute inset-x-0 h-16 -translate-y-1/2 bg-gradient-to-b from-transparent via-accent/10 to-transparent">
                  <div className="absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
                </div>
              </div>

              <div className="relative">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                    <FileText size={14} className="text-accent" />
                    {t("docLabel")}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-2xs font-semibold text-accent">
                    <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                    {t("scanning")}
                  </span>
                </div>

                <h3 className="text-xl font-bold leading-snug text-ink">{t("docTitle")}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={15} className="text-ink-subtle" />
                    {t("docAgency")}
                  </span>
                  <span className="font-semibold text-ink">฿12,500,000</span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={15} className="text-ink-subtle" />
                    {t("docDays")}
                  </span>
                </div>

                <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  {t("requirementsHeading")}
                </p>
                <ol className="space-y-2">
                  {items.map((item, i) => {
                    const isActive = i === active;
                    return (
                      <li
                        key={item.label}
                        className={`relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm transition-all duration-300 ${
                          isActive ? "bg-accent-soft/70 text-ink" : "text-ink-muted"
                        }`}
                      >
                        <span
                          className={`absolute inset-y-0 left-0 w-1 origin-top bg-accent transition-transform duration-300 ${
                            isActive ? "scale-y-100" : "scale-y-0"
                          }`}
                        />
                        <span className="w-5 text-xs font-bold tabular-nums text-ink-subtle">{String(i + 1).padStart(2, "0")}</span>
                        <span className="flex-1 font-medium">{item.label}</span>
                        <span className={`text-xs font-semibold ${isActive ? "text-accent" : "text-ink-subtle"}`}>{item.required}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>

          {/* Checked against the company profile */}
          <div className="glass rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <SegmentedRing items={items} active={active} score={score} />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{t("yourCompany")}</p>
                {/* Re-keyed so it fades in fresh for each requirement */}
                <div key={active} className="animate-fade-up mt-2" aria-live="polite">
                  <p className="text-lg font-bold text-ink">{current.label}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t("required")}: <span className="font-medium text-ink">{current.required}</span>
                    <br />
                    {t("yours")}:{" "}
                    <span className={`font-semibold ${STATUS_STYLE[current.status].text}`}>{current.yours}</span>
                  </p>
                </div>
              </div>
            </div>

            <ul className="mt-7 space-y-2">
              {items.map((item, i) => {
                const style = STATUS_STYLE[item.status];
                const isActive = i === active;
                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      onPointerEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onClick={() => setActive(i)}
                      aria-pressed={isActive}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                        isActive
                          ? "translate-x-1 border-accent/40 bg-surface shadow-[0_8px_24px_-12px_rgb(225_29_72/35%)]"
                          : "border-transparent hover:bg-surface/60"
                      }`}
                    >
                      <style.icon size={18} className={`shrink-0 ${style.text}`} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{item.label}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-bold tabular-nums ${style.chip}`}>
                        {item.status === "pass" ? `+${item.weight}` : `0 / ${item.weight}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-center text-xs text-ink-subtle">{t("hint")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
