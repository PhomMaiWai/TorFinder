"use client";

import { Check, Minus } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * The one checkbox every filter in the sidebar draws. `indeterminate` has no
 * HTML attribute — it exists only as a DOM property — so it is written on the
 * node directly, and the dash it shows is styled off the `indeterminate:`
 * variant rather than tracked in React state.
 */
export function FilterCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <span className="relative flex items-center">
      <input
        ref={ref}
        type="checkbox"
        aria-label={ariaLabel}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer size-4 cursor-pointer appearance-none rounded border border-zinc-300 bg-white transition-all checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      <Check
        size={12}
        strokeWidth={3}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100"
      />
      <Minus
        size={12}
        strokeWidth={3}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-indeterminate:opacity-100"
      />
    </span>
  );
}
