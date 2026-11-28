import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/** A palette whose shades come from CSS variables (RGB channels), so the theme and dark mode can swap them at runtime. */
const varScale = (name: string) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [
      shade,
      `rgb(var(--${name}-${shade}) / <alpha-value>)`,
    ]),
  );

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      colors: {
        // EspoCRM-style neutral greys by day, deep navy by night. Every page's slate/neutral classes follow these.
        slate: varScale("slate"),
        neutral: varScale("slate"),
        // The app's accent was indigo everywhere; it now points at the brand (EspoCRM blue) scale.
        indigo: varScale("brand"),
        brand: varScale("brand"),
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: { DEFAULT: "rgb(var(--card) / <alpha-value>)", foreground: "rgb(var(--card-foreground) / <alpha-value>)" },
        popover: { DEFAULT: "rgb(var(--popover) / <alpha-value>)", foreground: "rgb(var(--popover-foreground) / <alpha-value>)" },
        primary: { DEFAULT: "rgb(var(--primary) / <alpha-value>)", foreground: "rgb(var(--primary-foreground) / <alpha-value>)" },
        secondary: { DEFAULT: "rgb(var(--secondary) / <alpha-value>)", foreground: "rgb(var(--secondary-foreground) / <alpha-value>)" },
        muted: { DEFAULT: "rgb(var(--muted) / <alpha-value>)", foreground: "rgb(var(--muted-foreground) / <alpha-value>)" },
        accent: { DEFAULT: "rgb(var(--accent) / <alpha-value>)", foreground: "rgb(var(--accent-foreground) / <alpha-value>)" },
        destructive: { DEFAULT: "rgb(var(--destructive) / <alpha-value>)", foreground: "rgb(var(--destructive-foreground) / <alpha-value>)" },
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        sidebar: {
          DEFAULT: "var(--sidebar-bg)",
          border: "var(--sidebar-border)",
          hover: "var(--sidebar-hover)",
          active: "var(--sidebar-active)",
        },
      },
      // Squarish corners everywhere: the radius scale pages already use (rounded … rounded-3xl) is kept tight on purpose.
      borderRadius: {
        sm: "2px",
        DEFAULT: "3px",
        md: "3px",
        lg: "4px",
        xl: "4px",
        "2xl": "6px",
        "3xl": "8px",
      },
      // CRM weights: nothing heavier than semibold.
      fontWeight: {
        bold: "600",
        extrabold: "600",
        black: "600",
      },
      // Flat surfaces: soft, short shadows only.
      boxShadow: {
        xs: "0 1px 1px 0 rgb(0 0 0 / 0.03)",
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        DEFAULT: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        md: "0 2px 4px -1px rgb(0 0 0 / 0.06)",
        lg: "0 4px 12px -2px rgb(0 0 0 / 0.08)",
        xl: "0 8px 20px -4px rgb(0 0 0 / 0.10)",
        "2xl": "0 12px 32px -6px rgb(0 0 0 / 0.16)",
      },
    },
  },
  plugins: [animate],
};
export default config;
