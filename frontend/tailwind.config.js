/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Manrope', 'sans-serif'],
        body: ['Public Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        midnight: {
          900: '#0B1120',
          800: '#111827',
          700: '#1E293B',
        },
        clinical: {
          sky: '#38BDF8',
          'sky-hover': '#0EA5E9',
          indigo: '#6366F1',
          pink: '#F472B6',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#F43F5E',
          info: '#3B82F6',
        },
      },
    },
  },
  plugins: [],
};
