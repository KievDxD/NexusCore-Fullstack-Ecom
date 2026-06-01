/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
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
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'slide-down': 'slide-down 0.3s ease-out both',
        'spin-slow': 'spin-slow 3s linear infinite',
      },
    },
  },
  plugins: [],
}