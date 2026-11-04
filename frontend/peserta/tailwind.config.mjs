/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fb',
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
          700: '#095196',
          800: '#07407b',
          900: '#062d58',
          950: '#041c38',
        },
        navy: {
          800: '#093a70',
          900: '#062b55',
          950: '#041d3b',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
