import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: {
          deep: "var(--background-deep)",
          base: "var(--background-base)",
          elevated: "var(--background-elevated)"
        },
        foreground: {
          DEFAULT: "var(--foreground)",
          muted: "var(--foreground-muted)",
          subtle: "rgba(255,255,255,0.60)"
        },
        accent: {
          DEFAULT: "#5E6AD2",
          bright: "#6872D9",
          glow: "rgba(94,106,210,0.30)"
        }
      },
      boxShadow: {
        glass:
          "0 0 0 1px rgba(255,255,255,0.06),0 2px 20px rgba(0,0,0,0.4),0 0 40px rgba(0,0,0,0.2)",
        "glass-hover":
          "0 0 0 1px rgba(255,255,255,0.10),0 8px 40px rgba(0,0,0,0.5),0 0 80px rgba(94,106,210,0.10)",
        accent:
          "0 0 0 1px rgba(94,106,210,0.5),0 4px 12px rgba(94,106,210,0.3),inset 0 1px 0 0 rgba(255,255,255,0.2)"
      },
      fontFamily: {
        sans: ["Inter", "Geist Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"]
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-20px) rotate(1deg)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" }
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        float: "float 9s ease-in-out infinite",
        "float-slow": "float 12s ease-in-out infinite",
        shimmer: "shimmer 4s linear infinite",
        "fade-up": "fade-up 600ms cubic-bezier(0.16,1,0.3,1) both"
      }
    }
  },
  plugins: []
};

export default config;
