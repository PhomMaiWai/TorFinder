"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { FilterCheckbox } from "./filter-checkbox";

/** e-GP publishes an agency as "สำนักงานใหญ่ · หน่วยงานย่อย". */
const SEPARATOR = " · ";

type AgencyChild = { value: string; label: string; count: number };

type AgencyGroup = {
  name: string;
  /** Every agency string under this group, the group's own entry included. */
  values: string[];
  children: AgencyChild[];
  count: number;
};

/**
 * Groups the flat agency strings into one level of nesting. Announcements are
 * counted while grouping so the sidebar can show how much each branch holds
 * without a second pass over the records.
 */
function buildGroups(agencies: string[]): AgencyGroup[] {
  type Draft = { own: string | null; children: Map<string, AgencyChild>; count: number };
  const drafts = new Map<string, Draft>();

  for (const agency of agencies) {
    const separatorAt = agency.indexOf(SEPARATOR);
    const name = separatorAt === -1 ? agency : agency.slice(0, separatorAt);

    let draft = drafts.get(name);
    if (!draft) {
      draft = { own: null, children: new Map(), count: 0 };
      drafts.set(name, draft);
    }
    draft.count++;

    if (separatorAt === -1) {
      draft.own = agency;
      continue;
    }

    const child = draft.children.get(agency);
    if (child) child.count++;
    else
      draft.children.set(agency, {
        value: agency,
        label: agency.slice(separatorAt + SEPARATOR.length),
        count: 1,
      });
  }

  const collator = new Intl.Collator("th");

  return [...drafts]
    .map(([name, draft]) => {
      const children = [...draft.children.values()].sort((a, b) =>
        collator.compare(a.label, b.label),
      );
      return {
        name,
        children,
        count: draft.count,
        values: draft.own ? [draft.own, ...children.map((c) => c.value)] : children.map((c) => c.value),
      };
    })
    .sort((a, b) => collator.compare(a.name, b.name));
}

const rowCls =
  "flex w-full items-center gap-2.5 rounded-lg py-1.5 text-left text-[13px] leading-snug transition-colors";

export function AgencyFilter({
  title,
  /** One entry per announcement — duplicates are what the counts are made of. */
  agencies,
  selected,
  onChange,
}: {
  title: string;
  agencies: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const groups = useMemo(() => buildGroups(agencies), [agencies]);
  // Membership is checked once per rendered row, so a Set beats scanning the
  // selection array for every agency on the page.
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  if (groups.length === 0) return null;

  function toggleGroup(group: AgencyGroup, checked: boolean) {
    if (checked) {
      onChange([...new Set([...selected, ...group.values])]);
      setExpanded((current) => new Set(current).add(group.name));
      return;
    }
    const removed = new Set(group.values);
    onChange(selected.filter((value) => !removed.has(value)));
  }

  function toggleValue(value: string, checked: boolean) {
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value));
  }

  function toggleExpanded(name: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  }

  return (
    <div className="mb-7">
      <h3 className="mb-2 text-sm font-bold text-zinc-900">{title}</h3>
      <div className="-mx-1.5 max-h-80 space-y-0.5 overflow-y-auto px-1.5">
        {groups.map((group) => {
          const selectedCount = group.values.reduce(
            (total, value) => total + (selectedSet.has(value) ? 1 : 0),
            0,
          );
          const isOpen = expanded.has(group.name);

          return (
            <div key={group.name}>
              <div className={rowCls}>
                <FilterCheckbox
                  checked={selectedCount === group.values.length}
                  indeterminate={selectedCount > 0}
                  onChange={(checked) => toggleGroup(group, checked)}
                  ariaLabel={group.name}
                />

                {group.children.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(group.name)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-zinc-700 hover:text-zinc-950"
                  >
                    <ChevronRight
                      size={14}
                      className={`shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    <span className="min-w-0 flex-1 font-medium">{group.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                      {group.count}
                    </span>
                  </button>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 text-zinc-600">
                    <span className="min-w-0 flex-1">{group.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                      {group.count}
                    </span>
                  </span>
                )}
              </div>

              {/* Sub-units are mounted only while open: a few hundred agencies
                  would otherwise render as thousands of idle rows. */}
              {isOpen &&
                group.children.map((child) => (
                  <div key={child.value} className={`${rowCls} pl-6`}>
                    <FilterCheckbox
                      checked={selectedSet.has(child.value)}
                      onChange={(checked) => toggleValue(child.value, checked)}
                      ariaLabel={child.label}
                    />
                    <span className="min-w-0 flex-1 text-zinc-600">{child.label}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                      {child.count}
                    </span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
