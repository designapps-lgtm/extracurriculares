/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effaf6",
          100: "#d0f3e8",
          200: "#a4e6d4",
          300: "#6bd4bb",
          400: "#36bda0",
          500: "#1a9f86",
          600: "#166d5a",
          700: "#145a4a",
          800: "#14483c",
          900: "#133c33",
          950: "#07221c",
        },
        surface: {
          50: "#faf9f7",
          100: "#f3f1ed",
          200: "#e8e4dd",
          300: "#d4cec3",
          400: "#b8b0a2",
          500: "#a19788",
          600: "#8a7e6f",
          700: "#73675b",
          800: "#60564d",
          900: "#514942",
          950: "#2b2622",
        },
        terracotta: {
          50: "#fdf6f0",
          100: "#fae9d8",
          200: "#f5d1b0",
          300: "#efb27e",
          400: "#e88a4a",
          500: "#e26d26",
          600: "#d4541c",
          700: "#b04018",
          800: "#8c341b",
          900: "#712d19",
          950: "#3d140a",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover":
          "0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};
