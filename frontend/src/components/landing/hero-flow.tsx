"use client";

import { Bell, Building2, FileText, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

const STEP_MS = 2600;
const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;
const SCORE = 92;

/**
 * Where each card sits around the headline: two on the left (input), two on
 * the right (output), staggered so they read as a path rather than a grid.
 */
const POSITIONS = [
  "left-2 top-[7.5rem] xl:left-4",
  "left-5 top-[22rem] xl:left-10",
  "right-5 top-[9rem] xl:right-10",
  "right-2 top-[23.5rem] xl:right-4",
];

function StepCard({
  step,
  label,
  icon,
  active,
  dimmed,
  className,
  children,
}: {
  step: number;
  label: string;
  icon: ReactNode;
  active: boolean;
  dimmed: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`animate-fade-up absolute w-52 xl:w-56 ${className}`}
      style={{ animationDelay: `${500 + step * 90}ms` }}
    >
      <div
        className={`glass-strong rounded-2xl p-3.5 transition-all duration-500 ease-out ${
          active
            ? "scale-[1.03] border-accent/40 shadow-[0_18px_40px_-14px_rgb(225_29_72/35%)]"
            : dimmed
              ? "scale-[0.97] opacity-55"
              : ""
        }`}
      >
        <div className="mb-2.5 flex items-center gap-2">
          <span
            className={`grid size-5 shrink-0 place-items-center rounded-full text-2xs font-bold transition-colors duration-500 ${
              active ? "bg-accent text-white" : "bg-surface-alt text-ink-muted"
            }`}
          >
            {step}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{label}</span>
          <span className={`transition-colors duration-500 ${active ? "text-accent" : "text-ink-subtle"}`}>{icon}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Dashed link between two cards on the same side; it flows while its target step plays. */
function Connector({ side, flowing }: { side: "left" | "right"; flowing: boolean }) {
  const d = side === "left" ? "M 30 0 C 30 40, 60 50, 60 90" : "M 60 0 C 60 40, 30 50, 30 90";
  return (
    <svg
      viewBox="0 0 90 90"
      className={`absolute h-24 w-24 ${side === "left" ? "left-16 top-[17.25rem]" : "right-16 top-[18.75rem]"}`}
    >
      <path
        d={d}
        fill="none"
        strokeWidth="2"
        strokeDasharray="4 6"
        strokeLinecap="round"
        className={`transition-colors duration-500 ${flowing ? "animate-dash stroke-accent" : "stroke-border"}`}
      />
    </svg>
  );
}

/**
 * The product's pipeline told around the hero headline: pull new TORs, read
 * them, match, alert. One step plays at a time, so it guides the eye instead
 * of competing with the call to action.
 */
export function HeroFlow() {
  const t = useTranslations("LandingHeroFlow");
  const items = t.raw("step1Items") as string[];
  const chips = t.raw("step2Chips") as string[];

  // -1 = no step singled out (reduced motion): every card shows its end state.
  const [active, setActive] = useState(0);
  // Bumped on every step change so the active card's animations replay.
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [still, setStill] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(query.matches);
    query.addEventListener("change", sync);
    const frame = requestAnimationFrame(sync);
    return () => {
      query.removeEventListener("change", sync);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Stop the loop once the hero scrolls away; no point animating unseen cards.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !onScreen || still) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % 4);
      setCycle((c) => c + 1);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [paused, onScreen, still]);

  const current = still ? -1 : active;
  const isActive = (i: number) => current === i;
  const isDimmed = (i: number) => current !== -1 && current !== i;
  // Replay animations only on the card that is playing.
  const keyFor = (i: number) => (isActive(i) ? `play-${cycle}` : "rest");

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 mx-auto hidden h-full max-w-[1240px] min-[1180px]:block"
    >
      <div
        className="pointer-events-auto contents"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        {/* 1 — new TORs arrive */}
        <StepCard
          step={1}
          label={t("step1Label")}
          icon={<FileText size={14} />}
          active={isActive(0)}
          dimmed={isDimmed(0)}
          className={`pointer-events-auto ${POSITIONS[0]}`}
        >
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-medium text-ink-muted">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            {t("step1Source")}
          </p>
          <ul key={keyFor(0)} className="space-y-1.5">
            {items.map((item, i) => (
              <li
                key={item}
                className={`flex items-center gap-2 rounded-lg bg-surface-alt/70 px-2 py-1.5 ${isActive(0) ? "animate-slide-in" : ""}`}
                style={{ animationDelay: `${i * 160}ms` }}
              >
                <FileText size={12} className="shrink-0 text-ink-subtle" />
                <span className="min-w-0 flex-1 truncate text-2xs text-ink">{item}</span>
                {i === 0 && (
                  <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-2xs font-bold text-accent">
                    {t("newBadge")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </StepCard>

        <Connector side="left" flowing={isActive(1)} />

        {/* 2 — AI pulls out the qualifications */}
        <StepCard
          step={2}
          label={t("step2Label")}
          icon={<Sparkles size={14} />}
          active={isActive(1)}
          dimmed={isDimmed(1)}
          className={`pointer-events-auto ${POSITIONS[1]}`}
        >
          <div key={keyFor(1)}>
            <div className="mb-2.5 h-1 overflow-hidden rounded-full bg-surface-alt">
              <div
                className={`h-full origin-left rounded-full bg-gradient-to-r from-rose-400 to-accent ${isActive(1) ? "animate-bar" : ""}`}
                style={{ animationDuration: "1400ms" }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip, i) => (
                <span
                  key={chip}
                  className={`rounded-md border border-accent/20 bg-accent-soft/70 px-1.5 py-0.5 text-2xs font-medium text-accent-text ${
                    isActive(1) ? "animate-fade-up" : ""
                  }`}
                  style={{ animationDelay: `${500 + i * 220}ms`, animationDuration: "400ms" }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </StepCard>

        {/* 3 — scored against the company profile */}
        <StepCard
          step={3}
          label={t("step3Label")}
          icon={<Building2 size={14} />}
          active={isActive(2)}
          dimmed={isDimmed(2)}
          className={`pointer-events-auto ${POSITIONS[2]}`}
        >
          <div key={keyFor(2)} className="flex items-center gap-3">
            <div className="relative size-14 shrink-0">
              <svg viewBox="0 0 52 52" className="size-full -rotate-90">
                <circle cx="26" cy="26" r={RING_R} fill="none" strokeWidth="5" className="stroke-surface-alt" />
                <circle
                  cx="26"
                  cy="26"
                  r={RING_R}
                  fill="none"
                  strokeWidth="5"
                  strokeLinecap="round"
                  className={`stroke-accent ${isActive(2) ? "animate-ring" : ""}`}
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - SCORE / 100)}
                  style={{ "--ring-c": RING_C } as CSSProperties}
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-sm font-bold text-ink">{SCORE}</span>
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-2xs leading-snug text-ink-muted">{t("step3Caption")}</p>
              <div className="flex gap-1">
                {[0, 1, 2].map((n) => (
                  <span
                    key={n}
                    className={`h-1.5 w-5 rounded-full ${n < 2 ? "bg-success" : "bg-warn"} ${isActive(2) ? "animate-fade-up" : ""}`}
                    style={{ animationDelay: `${300 + n * 150}ms`, animationDuration: "350ms" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </StepCard>

        <Connector side="right" flowing={isActive(3)} />

        {/* 4 — the company hears about it */}
        <StepCard
          step={4}
          label={t("step4Label")}
          icon={<Bell size={14} className={isActive(3) ? "animate-bell origin-top" : ""} />}
          active={isActive(3)}
          dimmed={isDimmed(3)}
          className={`pointer-events-auto ${POSITIONS[3]}`}
        >
          <div
            key={keyFor(3)}
            className={`flex items-start gap-2.5 rounded-xl bg-surface-alt/70 p-2.5 ${isActive(3) ? "animate-pop-in" : ""}`}
            style={{ animationDuration: "380ms" }}
          >
            <span className="relative mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-white">
              <Bell size={13} />
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-success ring-2 ring-surface" />
            </span>
            <div className="min-w-0">
              <p className="text-2xs font-semibold leading-snug text-ink">{t("step4Message")}</p>
              <p className="mt-0.5 text-2xs text-danger">{t("step4Meta")}</p>
            </div>
          </div>
        </StepCard>
      </div>
    </div>
  );
}
