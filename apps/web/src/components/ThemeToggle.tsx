"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "row" }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Resolve effective theme (handles "system")
  const effective = mounted ? (theme === "system" ? resolvedTheme : theme) ?? "dark" : "dark";
  const isLight = effective === "light";

  function toggle() {
    setTheme(isLight ? "dark" : "light");
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggle}
        className="sb-pop-row"
        suppressHydrationWarning
      >
        {isLight ? <Moon /> : <Sun />}
        <span>{isLight ? "Dark mode" : "Light mode"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="sb-theme"
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      title={`Switch to ${isLight ? "dark" : "light"} mode`}
      suppressHydrationWarning
    >
      {isLight ? <Moon /> : <Sun />}
    </button>
  );
}

function Sun() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function Moon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
