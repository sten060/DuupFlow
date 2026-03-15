// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx,mdx}",
    "./src/lib/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette "Zeno"
        zbg: {
          DEFAULT: "#0B0F1A", // fond
          soft: "#101429",
        },
        zink: {
          50:  "#F8FAFC",
          100: "#EEF2F7",
          200: "#E3E8EF",
          300: "#CDD5DF",
          400: "#9AA4B2",
          500: "#697586",
          600: "#4B5565",
          700: "#364152",
          800: "#202939",
          900: "#111827",
        },
        zaccent: {
          indigo:  "#5B5BEA",
          fuchsia: "#FF3FD1",
          teal:    "#21E6C1",
          amber:   "#F59E0B",
        },
      },
      boxShadow: {
        glass: "0 8px 40px rgba(0,0,0,0.35)",
        glow:  "0 0 50px rgba(91,91,234,.25)",
      },
      borderColor: {
        stroke: "rgba(255,255,255,0.08)",
      },
      backgroundColor: {
        glass: "rgba(255,255,255,0.04)",
      },
      backdropBlur: {
        xs: "2px",
      },
      fontWeight: {
        extra: "900",
      },
      keyframes: {
        progress: {
          "0%":   { marginLeft: "-40%", width: "40%" },
          "50%":  { marginLeft: "30%",  width: "60%" },
          "100%": { marginLeft: "100%", width: "40%" },
        },
      },
      animation: {
        progress: "progress 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;