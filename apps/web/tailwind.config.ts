import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "var(--bg-0)",
          1: "var(--bg-1)",
          2: "var(--bg-2)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        text: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
          dim: "var(--text-dim)",
          faint: "var(--text-faint)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          glow: "var(--accent-glow)",
        },
        add: { DEFAULT: "var(--add)", soft: "var(--add-soft)" },
        rm:  { DEFAULT: "var(--rm)",  soft: "var(--rm-soft)"  },
        warn:{ DEFAULT: "var(--warn)",soft: "var(--warn-soft)"},
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular"],
      },
      borderRadius: {
        sm: "8px", md: "12px", lg: "16px", xl: "20px", "2xl": "24px",
      },
      backdropBlur: { card: "22px", sheet: "20px" },
      boxShadow: {
        card: "var(--shadow-card)",
        cta:  "var(--shadow-cta)",
      },
      transitionTimingFunction: {
        out:  "cubic-bezier(0.22, 1, 0.36, 1)",
        soft: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
} satisfies Config;
