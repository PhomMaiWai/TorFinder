"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { FilterCheckbox } from "./filter-checkbox";

/** e-GP publishes an agency as "สำนักงานใหญ่ · หน่วยงานย่อย". */
const SEPARATOR = " · ";

/**
 * The sidebar's top level: a handful of areas a reader thinks in, rather than
 * the dozens of offices e-GP names. An office is placed by the start of its
 * name; anything unrecognised still lands under "อื่นๆ", so no announcement
 * ever drops out of the filter.
 */
const CATEGORIES: { name: string; prefixes: string[] }[] = [
  { name: "การไฟฟ้านครหลวง (กฟน.)", prefixes: ["การไฟฟ้านครหลวง"] },
  {
    name: "ดิจิทัลและบริหารงาน กทม.",
    prefixes: [
      "สำนักดิจิทัล",
      "สำนักปลัด",
      "สำนักงบประมาณ",
      "สำนักการคลัง",
      "สำนักงานคณะกรรมการข้าราชการ",
      "สำนักงานเลขานุการสภา",
      "สำนักยุทธศาสตร์",
      "สำนักงานสถานธนานุบาล",
    ],
  },
  {
    name: "เมือง จราจร และสิ่งแวดล้อม",
    prefixes: [
      "สำนักสิ่งแวดล้อม",
      "สำนักการจราจร",
      "สำนักการวางผัง",
      "สำนักการโยธา",
      "สำนักการระบายน้ำ",
      "สำนักป้องกันและบรรเทาสาธารณภัย",
    ],
  },
  { name: "สาธารณสุขและการแพทย์", prefixes: ["สำนักการแพทย์", "สำนักอนามัย"] },
  {
    name: "การศึกษา สังคม และวัฒนธรรม",
    prefixes: ["สำนักการศึกษา", "สำนักวัฒนธรรม", "กรมพัฒนาสังคม"],
  },
  { name: "สำนักงานเขต", prefixes: ["สำนักงานเขต"] },
];

const OTHER_CATEGORY = "อื่นๆ";

function categoryOf(office: string): string {
  return (
    CATEGORIES.find((c) => c.prefixes.some((p) => office.startsWith(p)))?.name ?? OTHER_CATEGORY
  );
}

/** A main office, its sub-units folded in: selecting it selects all of them. */
type Office = { name: string; values: string[]; count: number };

type Category = {
  name: string;
  /** Every agency string in the category. */
  values: string[];
  offices: Office[];
  count: number;
};

/**
 * Groups the flat agency strings into category → main office. Announcements
 * are counted while grouping so the sidebar can show how much each branch
 * holds without a second pass over the records.
 */
function buildCategories(agencies: string[]): Category[] {
  const offices = new Map<string, { values: Set<string>; count: number }>();

  for (const agency of agencies) {
    const separatorAt = agency.indexOf(SEPARATOR);
    const name = separatorAt === -1 ? agency : agency.slice(0, separatorAt);

    let office = offices.get(name);
    if (!office) {
      office = { values: new Set(), count: 0 };
      offices.set(name, office);
    }
    office.values.add(agency);
    office.count++;
  }

  const byCategory = new Map<string, Office[]>();
  for (const [name, office] of offices) {
    const category = categoryOf(name);
    const list = byCategory.get(category) ?? [];
    list.push({ name, values: [...office.values], count: office.count });
    byCategory.set(category, list);
  }

  const order = [...CATEGORIES.map((c) => c.name), OTHER_CATEGORY];

  return order.flatMap((name) => {
    const list = byCategory.get(name);
    if (!list) return [];
    // Busiest office first: that is usually the one a reader came for.
    list.sort((a, b) => b.count - a.count);
    return [
      {
        name,
        offices: list,
        values: list.flatMap((o) => o.values),
        count: list.reduce((total, o) => total + o.count, 0),
      },
    ];
  });
}

const rowCls =
  "flex w-full items-center gap-2.5 rounded-lg py-1.5 text-left text-sm leading-snug transition-colors";

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

  const categories = useMemo(() => buildCategories(agencies), [agencies]);
  // Membership is checked once per rendered row, so a Set beats scanning the
  // selection array for every agency on the page.
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  if (categories.length === 0) return null;

  function countSelected(values: string[]) {
    return values.reduce((total, value) => total + (selectedSet.has(value) ? 1 : 0), 0);
  }

  function toggleValues(values: string[], checked: boolean) {
    if (checked) {
      onChange([...new Set([...selected, ...values])]);
      return;
    }
    const removed = new Set(values);
    onChange(selected.filter((value) => !removed.has(value)));
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
      <h3 className="mb-2 text-sm font-bold text-ink">{title}</h3>
      <div className="-mx-1.5 max-h-80 space-y-0.5 overflow-y-auto px-1.5">
        {categories.map((category) => {
          const selectedCount = countSelected(category.values);
          const isOpen = expanded.has(category.name);
          const canExpand = category.offices.length > 1;

          return (
            <div key={category.name}>
              <div className={rowCls}>
                <FilterCheckbox
                  checked={selectedCount === category.values.length}
                  indeterminate={selectedCount > 0}
                  onChange={(checked) => toggleValues(category.values, checked)}
                  ariaLabel={category.name}
                />

                {canExpand ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(category.name)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-ink hover:text-ink"
                  >
                    <ChevronRight
                      size={14}
                      className={`shrink-0 text-ink-subtle transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    <span className="min-w-0 flex-1 font-medium">{category.name}</span>
                    <span className="shrink-0 text-2xs tabular-nums text-ink-subtle">
                      {category.count}
                    </span>
                  </button>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 pl-5 text-ink">
                    <span className="min-w-0 flex-1 font-medium">{category.name}</span>
                    <span className="shrink-0 text-2xs tabular-nums text-ink-subtle">
                      {category.count}
                    </span>
                  </span>
                )}
              </div>

              {isOpen &&
                category.offices.map((office) => {
                  const officeSelected = countSelected(office.values);
                  return (
                    <div key={office.name} className={`${rowCls} pl-6`}>
                      <FilterCheckbox
                        checked={officeSelected === office.values.length}
                        indeterminate={officeSelected > 0}
                        onChange={(checked) => toggleValues(office.values, checked)}
                        ariaLabel={office.name}
                      />
                      <span className="min-w-0 flex-1 text-ink-muted">{office.name}</span>
                      <span className="shrink-0 text-2xs tabular-nums text-ink-subtle">
                        {office.count}
                      </span>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
