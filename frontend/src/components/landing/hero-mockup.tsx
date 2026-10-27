import { Bell, CircleCheck, Search } from "lucide-react";

const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R;

const ROWS = [
  { score: 92, widths: ["w-4/5", "w-1/2"] },
  { score: 87, widths: ["w-3/4", "w-2/5"] },
  { score: 74, widths: ["w-2/3", "w-1/3"] },
];

function ScoreRing({ score, delay }: { score: number; delay: number }) {
  return (
    <div className="relative size-11 shrink-0">
      <svg viewBox="0 0 44 44" className="size-full -rotate-90">
        <circle cx="22" cy="22" r={RING_R} fill="none" strokeWidth="4" className="stroke-border" />
        <circle
          cx="22"
          cy="22"
          r={RING_R}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="animate-ring stroke-accent"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - score / 100)}
          style={{ "--ring-c": RING_C, animationDelay: `${delay}ms` } as React.CSSProperties}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-bold text-ink">{score}</span>
    </div>
  );
}

/** Decorative product preview — numbers and skeleton lines only, hidden from assistive tech. */
export function HeroMockup() {
  return (
    <div aria-hidden className="relative mx-auto mt-16 max-w-4xl">
      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <span className="size-2.5 rounded-full bg-danger/70" />
          <span className="size-2.5 rounded-full bg-warn/70" />
          <span className="size-2.5 rounded-full bg-success/70" />
          <div className="ml-4 flex h-7 flex-1 items-center gap-2 rounded-lg bg-surface-alt/70 px-3">
            <Search size={13} className="text-ink-subtle" />
            <span className="h-2 w-40 rounded-full bg-border" />
          </div>
        </div>

        <div className="grid gap-px bg-border/40 sm:grid-cols-[1fr_220px]">
          <div className="space-y-px">
            {ROWS.map((row, i) => (
              <div
                key={row.score}
                className="animate-fade-up flex items-center gap-4 bg-surface/70 p-4"
                style={{ animationDelay: `${600 + i * 120}ms` }}
              >
                <ScoreRing score={row.score} delay={800 + i * 120} />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className={`h-2.5 rounded-full bg-ink/80 ${row.widths[0]}`} />
                  <div className={`h-2 rounded-full bg-border ${row.widths[1]}`} />
                </div>
                <span className="hidden h-6 w-16 rounded-full bg-accent-soft sm:block" />
              </div>
            ))}
          </div>

          <div className="hidden space-y-4 bg-surface/70 p-4 sm:block">
            <div className="h-2.5 w-24 rounded-full bg-ink/80" />
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
              <div className="animate-bar h-full w-4/5 origin-left rounded-full bg-accent" style={{ animationDelay: "1000ms" }} />
            </div>
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <span className={`size-3.5 rounded-full ${n < 3 ? "bg-accent" : "border-2 border-border"}`} />
                <span className="h-2 flex-1 rounded-full bg-border" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-strong animate-float absolute -left-3 top-24 hidden items-center gap-2.5 rounded-xl px-3.5 py-2.5 sm:flex lg:-left-10">
        <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
          <Bell size={15} />
        </span>
        <span className="space-y-1.5">
          <span className="block h-2 w-20 rounded-full bg-ink/80" />
          <span className="block h-1.5 w-12 rounded-full bg-border" />
        </span>
      </div>

      <div className="glass-strong animate-float-slow absolute -right-3 bottom-16 hidden items-center gap-2.5 rounded-xl px-3.5 py-2.5 sm:flex lg:-right-10">
        <CircleCheck size={20} className="text-success" />
        <span className="space-y-1.5">
          <span className="block h-2 w-16 rounded-full bg-ink/80" />
          <span className="block h-1.5 w-10 rounded-full bg-border" />
        </span>
      </div>
    </div>
  );
}
