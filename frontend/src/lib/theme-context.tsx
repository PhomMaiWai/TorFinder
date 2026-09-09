"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "torr:theme";

function readFromStorage(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function createStore() {
  let listeners: Array<() => void> = [];
  let cachedTheme: Theme = readFromStorage();

  function subscribe(callback: () => void) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter((l) => l !== callback);
    };
  }

  function getSnapshot() {
    return cachedTheme;
  }

  function toggle() {
    cachedTheme = cachedTheme === "light" ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, cachedTheme);
    listeners.forEach((notify) => notify());
  }

  return { subscribe, getSnapshot, toggle };
}

const store = createStore();

function getServerSnapshot(): Theme {
  return "light";
}

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: store.toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
