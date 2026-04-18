import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        brand: {
          primary: "#1F2937",
          accent: "#D97706",
          bg: "#FAF7F0",
          card: "#FFFFFF",
          muted: "#6B6358",
          faint: "#9A9184",
          border: "#E4DDC9",
          "border-strong": "#C9BFA5",
          success: "#3A6E42",
          warn: "#A06428",
          error: "#9B2C2C",
        },
        border: "#E4DDC9",
        input: "#E4DDC9",
        ring: "#1F2937",
        background: "#FAF7F0",
        foreground: "#1F2937",
        primary: {
          DEFAULT: "#1F2937",
          foreground: "#FAF7F0",
        },
        secondary: {
          DEFAULT: "#FFFFFF",
          foreground: "#1F2937",
        },
        destructive: {
          DEFAULT: "#9B2C2C",
          foreground: "#FAF7F0",
        },
        muted: {
          DEFAULT: "#E4DDC9",
          foreground: "#6B6358",
        },
        accent: {
          DEFAULT: "#D97706",
          foreground: "#FAF7F0",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#1F2937",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#1F2937",
        },
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        label: "0.12em",
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
