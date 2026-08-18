import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";

/* ── Page header (Baserow-style) ─────────────────── */

type PageHeaderProps = {
  title: string;
  description?: string;
  badge?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
};

export function PageHeader({
  title,
  description,
  badge,
  action,
  secondaryAction,
}: PageHeaderProps) {
  return (
    <div className="border-b border-border bg-white px-10 pt-8 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {badge && (
              <span className="rounded-full border border-border bg-surface-alt px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1.5 text-sm text-ink-muted">{description}</p>
          )}
        </div>
        {(action || secondaryAction) && (
          <div className="flex items-center gap-2">
            {secondaryAction}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  href,
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const cls =
    "inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-dark";

  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  href,
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const cls =
    "inline-flex h-9 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-alt";

  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/* ── Summary cards ───────────────────────────────── */

type SummaryCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export function SummaryCard({ label, value, hint }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-border bg-white px-5 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function SummaryGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
  );
}

/* ── Section ─────────────────────────────────────── */

type SectionProps = {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export function Section({ title, action, children }: SectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ── Filter bar ──────────────────────────────────── */

type FilterPill = { id: string; label: string };

type FilterBarProps = {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  pills?: FilterPill[];
  activePill?: string;
  onPillChange?: (id: string) => void;
};

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "ค้นหา...",
  pills,
  activePill,
  onPillChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/10">
        <Search size={15} className="shrink-0 text-ink-subtle" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
        />
      </label>
      {pills && onPillChange && (
        <div className="flex flex-wrap gap-1.5">
          {pills.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onPillChange(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activePill === id
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:text-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── List (Baserow-style rows) ───────────────────── */

export function ItemList({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white divide-y divide-border">
      {children}
    </div>
  );
}

type ItemRowProps = {
  href?: string;
  onClick?: () => void;
  isOpen?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
  actions?: React.ReactNode;
  expandedContent?: React.ReactNode;
};

export function ItemRow({
  href,
  onClick,
  isOpen,
  icon,
  iconBg,
  title,
  subtitle,
  trailing,
  actions,
  expandedContent,
}: ItemRowProps) {
  const rowCls = `group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-alt/70 ${
    href || onClick ? "cursor-pointer" : ""
  }`;

  const content = (
    <>
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${iconBg}`}>
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p>
      </div>

      {trailing && <div className="hidden shrink-0 sm:block">{trailing}</div>}

      {actions && (
        <div
          className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}

      {(onClick || expandedContent) && (
        <ChevronDown
          size={16}
          className={`shrink-0 text-ink-subtle transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      )}
    </>
  );

  return (
    <div>
      {href ? (
        <Link href={href} className={rowCls}>
          {content}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={rowCls}>
          {content}
        </button>
      ) : (
        <div className={rowCls}>{content}</div>
      )}
      {expandedContent}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border py-16 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      )}
    </div>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 space-y-8 bg-[#fafafa] px-10 py-8 pb-12">{children}</div>;
}

/* ── Status badge ────────────────────────────────── */

type StatusBadgeProps = {
  label: string;
  variant?: "neutral" | "accent";
};

const BADGE_VARIANTS = {
  neutral: "bg-zinc-100 text-zinc-600",
  accent: "bg-accent-soft text-accent-text",
};

export function StatusBadge({ label, variant = "neutral" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${BADGE_VARIANTS[variant]}`}>
      {label}
    </span>
  );
}
