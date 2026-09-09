"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  showLabel: string;
  hideLabel: string;
};

export function PasswordInput({
  showLabel,
  hideLabel,
  className = "",
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();

  return (
    <div className="relative">
      <input
        {...props}
        id={props.id ?? inputId}
        type={visible ? "text" : "password"}
        className={`h-12 w-full rounded-lg border border-border pl-4 pr-12 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10 ${className}`}
      />
      <button
        type="button"
        // Toggling is a view preference, not part of the form data.
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-alt hover:text-ink"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
