"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light mode is parked during beta (Samuel 2026-05-27). The CSS variables,
 * tailwind config, and ThemeToggle component all remain wired so re-enabling
 * later is just: drop `forcedTheme`, drop `enableSystem={false}`, restore
 * the toggle inside the sidebar popover.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
      storageKey="uatchit-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
