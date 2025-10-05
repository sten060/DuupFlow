/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          indigo: "#5B5BEA",
          fuchsia: "#FF3FD1",
          dark: "#0B0B12",
          glass: "rgba(255,255,255,0.08)",
          stroke: "rgba(255,255,255,0.12)"
        }
      },
      boxShadow: {
        glass: "0 8px 30px rgba(0,0,0,0.25)",
        glow: "0 0 40px rgba(91,91,234,0.35), 0 0 60px rgba(255,63,209,0.25)"
      },
      borderRadius: { xl: "16px", "2xl": "20px" },
      animation: { "soft-pulse": "soft-pulse 3s ease-in-out infinite" },
      keyframes: {
        "soft-pulse": {
          "0%,100%": { boxShadow: "0 0 0 rgba(255,63,209,0)" },
          "50%": { boxShadow: "0 0 35px rgba(255,63,209,0.35)" }
        }
      }
    }
  },
  plugins: []
};