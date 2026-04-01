/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        th: {
          base: "rgb(var(--color-base) / <alpha-value>)",
          surface: "rgb(var(--color-surface) / <alpha-value>)",
          "surface-alt": "rgb(var(--color-surface-alt) / <alpha-value>)",
          border: "rgb(var(--color-border) / <alpha-value>)",
          "border-bright": "rgb(var(--color-border-bright) / <alpha-value>)",
          muted: "rgb(var(--color-muted) / <alpha-value>)",
          subtle: "rgb(var(--color-subtle) / <alpha-value>)",
          tertiary: "rgb(var(--color-tertiary) / <alpha-value>)",
          secondary: "rgb(var(--color-secondary) / <alpha-value>)",
          primary: "rgb(var(--color-primary) / <alpha-value>)",
          input: "rgb(var(--color-input) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
