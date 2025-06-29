/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Alice', 'serif'],
        sans: ['"Open Sans"', 'sans-serif'],
      },
      dropShadow: {
  aprenova: '1.5px 1.5px 1px #0cc0df',
},
      colors: {
        primary: '#1A73E8',
        accent: '#FFB703',
        background: '#FFFFFF',
        foreground: '#171717',
        muted: '#E5E5E5',

        success: '#34D399',
        warning: '#FBBF24',
        danger: '#EF4444',

        badge: {
          level1: '#E0F2FE',
          level2: '#C7D2FE',
          level3: '#FDE68A',
        },
      },
      spacing: {
        header: '4.5rem',
        section: '6rem',
        card: '2.5rem',
      },
      fontSize: {
        h1: ['2.25rem', { lineHeight: '2.75rem', fontWeight: '700' }],
        h2: ['1.875rem', { lineHeight: '2.25rem', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.5rem' }],
        small: ['0.875rem', { lineHeight: '1.25rem' }],
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0, 0, 0, 0.05)',
        strong: '0 4px 20px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        xl: '1.25rem',
      },
      transitionProperty: {
        layout: 'margin, padding, width, height',
      },
    },
  },
  plugins: [],
};
