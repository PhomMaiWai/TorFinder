import { Search } from "lucide-react";

import { OpportunityCard } from "@/components/dashboard/opportunity-card";
import { OPPORTUNITY_FILTERS } from "@/data/opportunities";
import type { Opportunity, OpportunityFilter } from "@/types/opportunity";

type OpportunityListProps = {
  opportunities: Opportunity[];
  searchQuery: string;
  activeFilter: OpportunityFilter;
  savedIds: number[];
  onSearchChange: (query: string) => void;
  onFilterChange: (filter: OpportunityFilter) => void;
  onSaveToggle: (id: number) => void;
  onClearFilters: () => void;
};

export function OpportunityList({
  opportunities,
  searchQuery,
  activeFilter,
  savedIds,
  onSearchChange,
  onFilterChange,
  onSaveToggle,
  onClearFilters,
}: OpportunityListProps) {
  return (
    <section>
      {/* Search */}
      <label className="flex items-center gap-2.5 rounded-xl border border-border bg-white px-4 py-3 transition-colors focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/10">
        <Search size={16} className="shrink-0 text-ink-subtle" />
        <input
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="ค้นหาโครงการ หน่วยงาน หรือเทคโนโลยี..."
          aria-label="ค้นหา TOR"
        />
      </label>

      {/* Filter tabs */}
      <div
        className="mt-4 flex items-center justify-between border-b border-border"
        role="tablist"
        aria-label="ตัวกรอง"
      >
        <div className="flex gap-5 overflow-x-auto [scrollbar-width:none]">
          {OPPORTUNITY_FILTERS.map((filter) => (
            <button
              key={filter}
              role="tab"
              aria-selected={activeFilter === filter}
              onClick={() => onFilterChange(filter)}
              className={`relative h-10 shrink-0 text-sm transition-colors ${
                activeFilter === filter
                  ? "font-semibold text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-accent"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <span className="shrink-0 text-sm text-ink-muted max-sm:hidden">
          {opportunities.length} รายการ
        </span>
      </div>

      {/* Cards */}
      <div className="mt-3 grid gap-2.5">
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            isSaved={savedIds.includes(opportunity.id)}
            onSaveToggle={onSaveToggle}
          />
        ))}

        {opportunities.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-white py-16 text-center">
            <Search size={28} className="mx-auto mb-3 text-ink-subtle opacity-40" />
            <p className="text-sm font-semibold text-ink">ไม่พบรายการที่ตรงกัน</p>
            <p className="mt-1 text-sm text-ink-muted">
              ลองเปลี่ยนคำค้นหาหรือตัวกรอง
            </p>
            <button
              onClick={onClearFilters}
              className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
            >
              ล้างตัวกรอง
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
