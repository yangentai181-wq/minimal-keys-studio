/** @type {import('tailwindcss').Config} */
import trac from "tailwindcss-react-aria-components";
import contQueries from "@tailwindcss/container-queries";

export default {
  content: ["./index.html", "./download.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
        keycap: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        primary: "#0D9488",
        "primary-content": "#FFFFFF",
        secondary: "#0F766E",
        accent: "#F97316",
        "base-content": "#0F172A",
        "base-100": "#FFFFFF",
        "base-200": "#F8FAFC",
        "base-300": "#E2E8F0",
        success: "#3B82F6",
        "success-content": "#FFFFFF",
        error: "light-dark(oklch(58% 0.22 27), oklch(62% 0.20 27))",
        "error-content": "#FFFFFF",
        warning: "light-dark(oklch(80% 0.16 80), oklch(80% 0.16 80))",
        "warning-content": "#3a2a00",
        info: "light-dark(oklch(66% 0.14 230), oklch(70% 0.14 230))",
        "info-content": "#FFFFFF",
        danger: "light-dark(oklch(55% 0.20 27), oklch(58% 0.19 27))",
        "danger-content": "#FFFFFF",
      },
    },
  },
  plugins: [contQueries, trac({ prefix: "rac" })],
};
