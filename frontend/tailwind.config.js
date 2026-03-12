/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0c10",
        "bg-2": "#0f1117",
        "bg-card": "#141720",
        "bg-hover": "#1a1f2e",
        border: "#1e2336",
        "border-light": "#252d42",
        "text-1": "#e8eaf0",
        "text-2": "#8892a4",
        "text-3": "#4a5568",
        blue: { DEFAULT: "#3b82f6", dim: "#1d3461" },
        green: { DEFAULT: "#10b981", dim: "#064e3b" },
        red: { DEFAULT: "#ef4444", dim: "#450a0a" },
        yellow: { DEFAULT: "#f59e0b" },
        purple: { DEFAULT: "#8b5cf6" },
      },
      fontFamily: {
        sans: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
