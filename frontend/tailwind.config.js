/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: 'hsl(var(--brand))',
        brand2: 'hsl(var(--brand2))',
        muted: 'hsl(var(--muted))',
        mutedDark: 'hsl(var(--muted-dark))',
        page: '#293e5cff', // azul grisáceo
      },
      boxShadow: {
        header: '0 10px 30px -12px rgba(16,24,40,.18)',
        badge: '0 6px 16px -8px rgba(37,99,235,.6)',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp .6s cubic-bezier(.22,.61,.36,1) both',
      },
      maxWidth: { content: '1120px' },
    },
  },
  plugins: [],
};
