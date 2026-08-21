/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        royal: '#2563eb',
        sky: '#60a5fa',
        emerald: '#059669',
        mint: '#4ade80',
        deepslate: '#0f172a',
        amber: '#f59e0b',
        orange: '#f97316',
      }
    },
  },
  plugins: [],
}