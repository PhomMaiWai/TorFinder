"use client";

import { Table2, BarChart3 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useId, useState, useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/*
 * Chart pieces for the dashboard, drawn to one spec: thin marks with 4px
 * rounded data-ends, 2px lines, hairline solid grid, text in ink tokens (never
 * the series color), and a table view on every chart so no value is reachable
 * only by hovering. Colors come from --chart-accent / --chart-muted.
 */

const AXIS_TICK = { fill: "var(--color-ink-muted)", fontSize: 12 };
const ANIMATION_MS = 900;

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Charts draw in once; people who asked for less motion get the final frame. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** ฿12.5M / ฿12.5 ล้าน — compact, in the reader's language. */
export function useBahtCompact() {
  const locale = useLocale();
  const format = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return (value: number) => `฿${format.format(value)}`;
}

export type TableView = { head: [string, string]; rows: [string, string][] };

/** The glass frame every chart sits in, with a chart/table switch. */
export function ChartCard({
  title,
  subtitle,
  icon,
  table,
  footnote,
  delay = 0,
  className = "",
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  table: TableView;
  footnote?: string;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("Dashboard");
  const [asTable, setAsTable] = useState(false);

  return (
    <section
      aria-label={title}
      className={`glass animate-fade-up flex flex-col rounded-2xl p-5 transition-shadow duration-300 hover:shadow-[0_16px_40px_-18px_rgb(225_29_72/30%)] ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          title={asTable ? t("showChart") : t("showTable")}
          aria-label={asTable ? t("showChart") : t("showTable")}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-alt hover:text-ink"
        >
          {asTable ? <BarChart3 size={16} /> : <Table2 size={16} />}
        </button>
      </header>

      <div className="min-h-0 flex-1">
        {table.rows.length === 0 ? (
          <p className="grid h-full min-h-40 place-items-center text-sm text-ink-subtle">{t("chartEmpty")}</p>
        ) : asTable ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-ink-subtle">
                <th className="pb-2 font-medium">{table.head[0]}</th>
                <th className="pb-2 text-right font-medium">{table.head[1]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {table.rows.map(([label, value]) => (
                <tr key={label}>
                  <td className="py-2 pr-3 text-ink">{label}</td>
                  <td className="py-2 text-right font-medium tabular-nums text-ink">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          children
        )}
      </div>

      {footnote && <p className="mt-3 text-2xs text-ink-subtle">{footnote}</p>}
    </section>
  );
}

export type TipProps = {
  active?: boolean;
  label?: unknown;
  payload?: ReadonlyArray<{ value?: unknown; payload?: unknown }>;
  format: (value: number) => string;
};

/** Value first and strongest; the category under it; a short line key, not a box. */
export function ChartTip({ active, payload, label, format }: TipProps) {
  const item = payload?.[0];
  if (!active || !item || typeof item.value !== "number") return null;
  const row = (item.payload ?? {}) as { label?: string; tip?: string };
  return (
    <div className="rounded-xl border border-border/70 bg-surface/95 px-3 py-2 shadow-[0_12px_30px_-12px_rgb(0_0_0/25%)] backdrop-blur-md">
      <p className="text-base font-bold text-ink">{format(item.value)}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
        <span className="h-0.5 w-3 rounded-full bg-[var(--chart-accent)]" />
        {row.tip ?? row.label ?? String(label ?? "")}
      </p>
    </div>
  );
}

/** One series over time: a 2px line, a faint wash, and the latest value marked at the end. */
export function TrendChart({
  data,
  format,
}: {
  data: { label: string; tip: string; value: number }[];
  format: (value: number) => string;
}) {
  const still = useReducedMotion();
  const gradientId = useId();
  const last = data.length - 1;

  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 22, right: 18, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-accent)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--chart-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            cursor={{ stroke: "var(--chart-muted)", strokeWidth: 1 }}
            content={({ active, label, payload }) => <ChartTip active={active} label={label} payload={payload} format={format} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-accent)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index === last && props.cx !== undefined && props.cy !== undefined ? (
                <circle
                  key="end"
                  cx={props.cx}
                  cy={props.cy}
                  r={5}
                  fill="var(--chart-accent)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              ) : (
                <g key={props.index} />
              )
            }
            activeDot={{ r: 6, fill: "var(--chart-accent)", stroke: "var(--color-surface)", strokeWidth: 2 }}
            isAnimationActive={!still}
            animationDuration={ANIMATION_MS}
            animationEasing="ease-out"
          >
            {/* Only the latest week is labelled; the axis and tooltip carry the rest. */}
            <LabelList
              dataKey="value"
              content={(props) =>
                props.index === last ? (
                  <text
                    x={Number(props.x)}
                    y={Number(props.y) - 12}
                    textAnchor="middle"
                    fill="var(--color-ink)"
                    fontSize={12}
                    fontWeight={700}
                  >
                    {String(props.value)}
                  </text>
                ) : null
              }
            />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Long Thai agency and category names: trim the tick, keep the full name on hover. */
function TruncatedTick({
  x,
  y,
  payload,
  max,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: unknown };
  max: number;
}) {
  const text = String(payload?.value ?? "");
  const short = text.length > max ? `${text.slice(0, max - 1)}…` : text;
  return (
    <text x={Number(x)} y={Number(y)} dy={4} textAnchor="end" fill="var(--color-ink-muted)" fontSize={12}>
      <title>{text}</title>
      {short}
    </text>
  );
}

/** Magnitude by name, largest first: horizontal bars with the value at each tip. */
export function RankedBars({
  data,
  format,
  labelWidth = 132,
}: {
  data: { label: string; value: number }[];
  format: (value: number) => string;
  labelWidth?: number;
}) {
  const still = useReducedMotion();
  const rows = data.map((row) => ({ ...row, display: format(row.value) }));

  return (
    <div style={{ height: Math.max(150, rows.length * 38) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 96, left: 0, bottom: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            tickLine={false}
            axisLine={false}
            tick={(props) => <TruncatedTick {...props} max={Math.floor(labelWidth / 8)} />}
          />
          <Tooltip
            cursor={{ fill: "var(--color-surface-alt)", fillOpacity: 0.6 }}
            content={({ active, label, payload }) => <ChartTip active={active} label={label} payload={payload} format={format} />}
          />
          <Bar
            dataKey="value"
            fill="var(--chart-accent)"
            radius={[0, 4, 4, 0]}
            barSize={16}
            isAnimationActive={!still}
            animationDuration={ANIMATION_MS}
            animationEasing="ease-out"
          >
            <LabelList dataKey="display" position="right" offset={8} fill="var(--color-ink)" fontSize={12} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Counts per band, where one part of the story matters: those bands in the
 * accent, the rest in the muted gray. Every column carries its own label.
 */
export function EmphasisColumns({
  data,
  format,
}: {
  data: { label: string; tip: string; value: number; emphasis: boolean }[];
  format: (value: number) => string;
}) {
  const still = useReducedMotion();

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} tickMargin={10} interval={0} />
          <YAxis hide allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--color-surface-alt)", fillOpacity: 0.6 }}
            content={({ active, label, payload }) => <ChartTip active={active} label={label} payload={payload} format={format} />}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            barSize={24}
            isAnimationActive={!still}
            animationDuration={ANIMATION_MS}
            animationEasing="ease-out"
          >
            {data.map((row) => (
              <Cell key={row.label} fill={row.emphasis ? "var(--chart-accent)" : "var(--chart-muted)"} />
            ))}
            <LabelList dataKey="value" position="top" offset={8} fill="var(--color-ink)" fontSize={12} fontWeight={700} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A stat tile's trend: no axes, no tooltip, the latest point marked. */
export function Sparkline({ values }: { values: number[] }) {
  const still = useReducedMotion();
  const gradientId = useId();
  const data = values.map((value, index) => ({ index, value }));
  const last = data.length - 1;

  return (
    <div className="h-10 w-24" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-accent)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-accent)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index === last && props.cx !== undefined && props.cy !== undefined ? (
                <circle key="end" cx={props.cx} cy={props.cy} r={3} fill="var(--chart-accent)" />
              ) : (
                <g key={props.index} />
              )
            }
            isAnimationActive={!still}
            animationDuration={ANIMATION_MS}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A share of a whole: same-hue track, accent fill. */
export function Meter({ value, total }: { value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent-soft" aria-hidden>
      <div
        className="animate-bar h-full origin-left rounded-full bg-[var(--chart-accent)]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
