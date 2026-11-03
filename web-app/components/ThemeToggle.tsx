"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

function read(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Light / dark / follow the system (SPEC §5). Remembered in this browser only. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  function choose(next: Theme) {
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // Storage blocked: the choice still applies to this page view.
    }
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    listeners.forEach((l) => l());
  }

  return (
    <div role="group" aria-label="Colour theme" className="flex gap-1">
      {(["system", "light", "dark"] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={theme === t}
          onClick={() => choose(t)}
          className={`cursor-pointer rounded-[6px] px-2 py-1 text-xs ${theme === t ? "bg-sheet font-semibold text-graphite" : "text-loupe hover:text-graphite"}`}
        >
          {t === "system" ? "Auto" : t === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}
