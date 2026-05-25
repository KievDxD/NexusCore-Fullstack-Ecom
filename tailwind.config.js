/** @type {import('tailwindcss').Config} */
export default {
content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
],
theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // ✅ Aplica Inter globalmente
      },
      colors: {
        themeBg: 'rgb(var(--theme-bg) / <alpha-value>)',
        themeCard: 'rgb(var(--theme-card) / <alpha-value>)',
        themeInput: 'rgb(var(--theme-input) / <alpha-value>)',
        themeBorder: 'rgb(var(--theme-border) / <alpha-value>)',
        themeText: 'rgb(var(--theme-text) / <alpha-value>)',
        themeTextMuted: 'rgb(var(--theme-text-muted) / <alpha-value>)',
        themeAccent: 'rgb(var(--theme-accent) / <alpha-value>)',
        themeAccentHover: 'rgb(var(--theme-accent-hover) / <alpha-value>)',
      },
    },
},
plugins: [],
}   