/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.{ts,tsx,mdx,html}", "!./node_modules/**", "!./.plasmo/**", "!./build/**"],
  theme: {
    extend: {
      colors: {
        bg: { 0: "#07070a", 1: "#0a0a0d", 2: "#0d0d12" },
        surface: {
          DEFAULT: "rgb(255 255 255 / 0.035)",
          2: "rgb(255 255 255 / 0.06)",
          3: "rgb(255 255 255 / 0.09)",
        },
        border: {
          DEFAULT: "rgb(255 255 255 / 0.07)",
          strong: "rgb(255 255 255 / 0.12)",
        },
        text: {
          DEFAULT: "#f3f3f6",
          muted: "rgb(243 243 246 / 0.62)",
          dim: "rgb(243 243 246 / 0.40)",
          faint: "rgb(243 243 246 / 0.22)",
        },
        accent: {
          DEFAULT: "oklch(72% 0.14 245)",
          soft: "oklch(72% 0.14 245 / 0.16)",
          glow: "oklch(72% 0.14 245 / 0.45)",
        },
        add: { DEFAULT: "oklch(78% 0.16 152)", soft: "oklch(78% 0.16 152 / 0.13)" },
        rm: { DEFAULT: "oklch(72% 0.18 18)", soft: "oklch(72% 0.18 18 / 0.13)" },
        warn: { DEFAULT: "oklch(78% 0.16 80)", soft: "oklch(78% 0.16 80 / 0.15)" },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { sm: "8px", md: "12px", lg: "16px", xl: "20px", "2xl": "24px" },
      backdropBlur: { card: "22px", sheet: "20px" },
    },
  },
  plugins: [],
};
