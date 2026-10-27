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
      className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      aria-label="Toggle theme"
    >
      {/* Re-keyed so the new icon spins in on every switch */}
      <span key={theme} className="animate-icon-swap">
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </span>
    </button>
  );
}
