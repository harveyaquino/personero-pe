/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rojo: { DEFAULT: '#C8102E', dark: '#9B0B22', light: '#FDEAED' },
        verde: { DEFAULT: '#1A7A3E', light: '#E6F4EC' },
        azul: { DEFAULT: '#1B4FBE', light: '#EBF0FD' },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
