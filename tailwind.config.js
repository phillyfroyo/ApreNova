/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Alice', 'serif'],
        sans: ['"Open Sans"', 'sans-serif'],
      },
      colors: {
        primary: '#1A73E8',      // example blue
        accent: '#FFB703',       // example yellow-orange
        background: '#FFFFFF',
        foreground: '#171717',
        muted: '#E5E5E5',
      },
    },
  },
  plugins: [],
};
