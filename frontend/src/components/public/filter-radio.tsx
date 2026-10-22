"use client";

import { Check } from "lucide-react";

/**
 * The one radio control a single-pick filter in the sidebar draws, styled to
 * match FilterCheckbox exactly — same size, square shape, border, accent fill
 * and checkmark — so it reads as part of the same filter list rather than the
 * browser's own (circular, differently marked) native radio.
 */
export function FilterRadio({
  name,
  checked,
  onChange,
  ariaLabel,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <span className="relative flex items-center">
      <input
        type="radio"
        name={name}
        aria-label={ariaLabel}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer size-4 cursor-pointer appearance-none rounded border border-border bg-surface transition-all checked:border-accent checked:bg-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      <Check
        size={12}
        strokeWidth={3}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
}
