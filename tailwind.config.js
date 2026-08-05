/** @type {import('tailwindcss').Config} */
import trac from "tailwindcss-react-aria-components";
import contQueries from "@tailwindcss/container-queries";

export default {
  content: ["./index.html", "./download.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontSize: {
        xs: "0.4rem",
      },
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
      },
    },
  },
  plugins: [contQueries, trac({ prefix: "rac" })],
};
