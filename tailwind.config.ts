import type { Config } from "tailwindcss";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primaryTheme: "rgb(var(--primary-rgb) / <alpha-value>)",
        secondaryTheme: "rgb(var(--primary-rgb) / <alpha-value>)",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        slideUp: "slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        fadeIn: "fadeIn 0.2s ease-out",
      },
    },
  },
  plugins: [
    require('daisyui'),
    require('@tailwindcss/typography'),
  ],
  daisyui: {
    themes: [
      {
        light: {
          ...require("daisyui/src/theming/themes")["light"],
          primaryTheme: "var(--primary-color)",
          // primary: "var(--primary-color)",
          // "primary-focus": "var(--primary-color)",
        },
        dark: {
          ...require("daisyui/src/theming/themes")["dark"],
          primaryTheme: "var(--primary-color)",
          // primary: "var(--primary-color)",
          // "primary-focus": "var(--primary-color)",
        },
      },
      "cupcake"
    ],
  },
} satisfies Config;
