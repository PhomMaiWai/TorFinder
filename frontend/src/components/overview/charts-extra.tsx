"use client";

import type { CSSProperties } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTip, useReducedMotion } from "@/components/dashboard/charts";

/*
 * The overview's extra chart forms. Same spec as dashboard/charts.tsx: 2px
 * lines, a 2px surface gap between touching fills, text in ink tokens except
 * inside a fill (where --on-ramp-N picks white or ink by the fill's lightness),
 * and a table or direct labels so no value is hover-only.
 */

const AXIS_TICK = { fill: "var(--color-ink-muted)", fontSize: 12 };
const ANIMATION_MS = 900;

/* ── Donut: part-to-whole for a few classes, with the legend as direct labels ── */

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  format,
}: {
  data: { label: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
  format: (value: number) => string;
}) {
  const still = useReducedMotion();
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="66%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={data.filter((d) => d.value > 0).length > 1 ? 2 : 0}
              cornerRadius={4}
              stroke="var(--color-surface)"
              strokeWidth={2}
              isAnimationActive={!still}
              animationDuration={ANIMATION_MS}
            >
              {data.map((d) => (
                <Cell key={d.label} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => (
                <ChartTip active={active} payload={payload} format={format} />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-bold leading-none text-ink">{centerValue}</p>
            <p className="mt-1 text-xs text-ink-muted">{centerLabel}</p>
          </div>
        </div>
      </div>

      <ul className="w-full space-y-2.5">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-3 text-sm">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 text-ink-muted">{d.label}</span>
            <span className="font-semibold text-ink">{format(d.value)}</span>
            <span className="w-11 text-right text-xs text-ink-subtle">
              {total > 0 ? `${Math.round((d.value / total) * 100)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Line: one running total over time, its latest value marked at the end ── */

export function ValueLine({
  data,
  format,
  axisFormat,
}: {
  data: { label: string; tip: string; value: number }[];
  format: (value: number) => string;
  axisFormat: (value: number) => string;
}) {
  const still = useReducedMotion();
  const last = data.length - 1;

  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 24, right: 28, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={64} tickFormatter={axisFormat} />
          <Tooltip
            cursor={{ stroke: "var(--chart-muted)", strokeWidth: 1 }}
            content={({ active, label, payload }) => (
              <ChartTip active={active} label={label} payload={payload} format={format} />
            )}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-accent)"
            strokeWidth={2}
            strokeLinecap="round"
            dot={(props: { cx?: number; cy?: number; index?: number; value?: number }) =>
              props.index === last && props.cx !== undefined && props.cy !== undefined ? (
                <g key="end">
                  <circle cx={props.cx} cy={props.cy} r={5} fill="var(--chart-accent)" stroke="var(--color-surface)" strokeWidth={2} />
                  <text x={props.cx} y={props.cy - 12} textAnchor="end" fill="var(--color-ink)" fontSize={12} fontWeight={700}>
                    {format(Number(props.value ?? 0))}
                  </text>
                </g>
              ) : (
                <g key={props.index} />
              )
            }
            activeDot={{ r: 6, fill: "var(--chart-accent)", stroke: "var(--color-surface)", strokeWidth: 2 }}
            isAnimationActive={!still}
            animationDuration={ANIMATION_MS}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Scatter: each open TOR as a dot — value against days left ── */

type ScatterPoint = { x: number; y: number; title: string; agency: string };

export function ValueScatter({
  points,
  xLabel,
  urgentDays,
  formatValue,
  formatDays,
}: {
  points: ScatterPoint[];
  xLabel: string;
  urgentDays: number;
  formatValue: (value: number) => string;
  formatDays: (days: number) => string;
}) {
  const still = useReducedMotion();
  const maxX = Math.max(urgentDays + 1, ...points.map((p) => p.x));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, left: 4, bottom: 18 }}>
          <CartesianGrid stroke="var(--chart-grid)" />
          {/* The "closing this week" band, where a big dot means act now */}
          <ReferenceArea x1={0} x2={urgentDays} fill="var(--chart-accent)" fillOpacity={0.07} stroke="none" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, maxX]}
            allowDecimals={false}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            label={{ value: xLabel, position: "insideBottom", offset: -12, fill: "var(--color-ink-muted)", fontSize: 12 }}
          />
          <YAxis type="number" dataKey="y" tick={AXIS_TICK} tickLine={false} axisLine={false} width={64} tickFormatter={formatValue} />
          <Tooltip
            cursor={{ stroke: "var(--chart-muted)", strokeWidth: 1, strokeDasharray: "0" }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as ScatterPoint | undefined;
              if (!active || !point) return null;
              return (
                <div className="max-w-64 rounded-xl border border-border/70 bg-surface/95 px-3 py-2 shadow-[0_12px_30px_-12px_rgb(0_0_0/25%)] backdrop-blur-md">
                  <p className="text-base font-bold text-ink">{formatValue(point.y)}</p>
                  <p className="mt-0.5 text-xs font-medium text-ink">{point.title}</p>
                  <p className="text-xs text-ink-muted">
                    {point.agency} · {formatDays(point.x)}
                  </p>
                </div>
              );
            }}
          />
          <Scatter
            data={points}
            isAnimationActive={!still}
            animationDuration={ANIMATION_MS}
            shape={(props: { cx?: number; cy?: number }) => (
              <g>
                {/* The hit target is bigger than the mark */}
                <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
                <circle cx={props.cx} cy={props.cy} r={6} fill="var(--chart-accent)" fillOpacity={0.85} stroke="var(--color-surface)" strokeWidth={2} />
              </g>
            )}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Treemap: each agency's share of all project value, darker = larger ── */

function rampStep(value: number, max: number): 1 | 2 | 3 | 4 {
  const share = max > 0 ? value / max : 0;
  return share > 0.6 ? 4 : share > 0.3 ? 3 : share > 0.12 ? 2 : 1;
}

export function ValueTreemap({
  data,
  format,
}: {
  data: { name: string; value: number }[];
  format: (value: number) => string;
}) {
  const still = useReducedMotion();
  const max = Math.max(0, ...data.map((d) => d.value));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="value"
          nameKey="name"
          aspectRatio={4 / 3}
          isAnimationActive={!still}
          animationDuration={ANIMATION_MS}
          content={(props: { x?: number; y?: number; width?: number; height?: number; name?: string; value?: number; depth?: number }) => {
            const { x = 0, y = 0, width = 0, height = 0, name = "", value = 0, depth = 1 } = props;
            if (depth === 0) return <g />;
            const step = rampStep(value, max);
            // Measure first: a label goes inside only when it fits with room to spare.
            const fits = width > 84 && height > 44;
            const maxChars = Math.floor((width - 16) / 7);
            const short = name.length > maxChars ? `${name.slice(0, Math.max(1, maxChars - 1))}…` : name;
            return (
              <g>
                <rect
                  x={x + 1}
                  y={y + 1}
                  width={Math.max(0, width - 2)}
                  height={Math.max(0, height - 2)}
                  rx={6}
                  fill={`var(--ramp-${step})`}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
                {fits && (
                  <>
                    <text x={x + 10} y={y + 22} fill={`var(--on-ramp-${step})`} fontSize={12} fontWeight={600}>
                      {short}
                    </text>
                    <text x={x + 10} y={y + 40} fill={`var(--on-ramp-${step})`} fontSize={12} fillOpacity={0.85}>
                      {format(value)}
                    </text>
                  </>
                )}
              </g>
            );
          }}
        >
          <Tooltip
            content={({ active, payload }) => {
              const item = payload?.[0];
              const row = item?.payload as { name?: string; value?: number } | undefined;
              if (!active || !row?.name) return null;
              return (
                <ChartTip active payload={[{ value: row.value ?? 0, payload: { label: row.name } }]} format={format} />
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Calendar heatmap: open TORs closing on each day, six weeks from this Monday ── */

function heatStep(count: number): 0 | 1 | 2 | 3 | 4 {
  return count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
}

export function ClosingCalendar({
  start,
  today,
  counts,
  locale,
  describe,
  lessLabel,
  moreLabel,
}: {
  start: number;
  /** Index of today in `counts`, from the server so render stays pure. */
  today: number;
  counts: number[];
  locale: string;
  describe: (date: string, count: number) => string;
  lessLabel: string;
  moreLabel: string;
}) {
  const tag = locale === "th" ? "th-TH" : "en-GB";
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "Asia/Bangkok" });
  const dayNum = new Intl.DateTimeFormat(tag, { day: "numeric", timeZone: "Asia/Bangkok" });
  const full = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" });
  const DAY_MS = 86_400_000;
  const todayIndex = today;

  return (
    // Capped so square day cells stay small; the card would otherwise grow as tall as it is wide.
    <div className="mx-auto w-full max-w-sm">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="pb-1 text-center text-2xs font-medium text-ink-subtle">
            {weekday.format(start + i * DAY_MS + 12 * 3_600_000)}
          </span>
        ))}
        {counts.map((count, i) => {
          const at = start + i * DAY_MS + 12 * 3_600_000;
          const step = heatStep(count);
          const past = i < todayIndex;
          const label = describe(full.format(at), count);
          return (
            <div
              key={i}
              role="img"
              aria-label={label}
              title={label}
              className={`animate-fade-up relative grid aspect-square place-items-center rounded-md text-2xs font-semibold transition-transform duration-200 hover:z-10 hover:scale-110 ${
                step === 0 ? "bg-surface-alt text-ink-subtle" : ""
              } ${past ? "opacity-35" : ""} ${i === todayIndex ? "ring-2 ring-ink ring-offset-1 ring-offset-surface" : ""}`}
              style={{
                animationDelay: `${i * 12}ms`,
                animationDuration: "400ms",
                ...(step > 0 ? ({ background: `var(--ramp-${step})`, color: `var(--on-ramp-${step})` } as CSSProperties) : {}),
              }}
            >
              {dayNum.format(at)}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-2xs text-ink-subtle" aria-hidden>
        {lessLabel}
        <span className="size-3 rounded-sm bg-surface-alt" />
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className="size-3 rounded-sm" style={{ background: `var(--ramp-${step})` }} />
        ))}
        {moreLabel}
      </div>
    </div>
  );
}

/* ── Ring gauges: the share of announcements that carry each fact ── */

const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

export function RingGauges({ items }: { items: { label: string; value: number; total: number }[] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item, i) => {
        const percent = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
        return (
          <div key={item.label} className="flex flex-col items-center text-center">
            <div className="relative size-24">
              <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden>
                <circle cx="36" cy="36" r={RING_R} fill="none" strokeWidth="7" stroke="var(--color-accent-soft)" />
                <circle
                  cx="36"
                  cy="36"
                  r={RING_R}
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  stroke="var(--chart-accent)"
                  className="animate-ring"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - percent / 100)}
                  style={{ "--ring-c": RING_C, animationDelay: `${i * 150}ms` } as CSSProperties}
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-lg font-bold text-ink">{percent}%</span>
            </div>
            <p className="mt-2 text-xs font-medium leading-snug text-ink">{item.label}</p>
            <p className="text-2xs text-ink-subtle">
              {item.value}/{item.total}
            </p>
          </div>
        );
      })}
    </div>
  );
}
