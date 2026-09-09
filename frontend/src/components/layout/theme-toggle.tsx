"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme-context";

/**
 * Reads the theme from the app's own provider rather than a library: the
 * provider is what writes the `.dark` class the design tokens key off, and it
 * shares the storage key with the pre-hydration script in the root layout.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-ink transition-colors hover:bg-surface-alt"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
