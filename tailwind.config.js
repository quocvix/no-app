/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#F8F9FA",
        surface: "#FFFFFF",
        cardBorder: "#F1F5F9",
        brandDark: "#111111",
        brandOrange: "#F97316",
        incomeGreen: "#16A34A",
        expenseDark: "#0F172A",
      },
    },
  },
  plugins: [],
};
