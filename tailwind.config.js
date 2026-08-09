/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './views/**/*.pug',
    './public/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        laterne: {
          pink: '#ed2791',
          ink: '#111111',
          cream: '#fffaf2',
        },
      },
      fontFamily: {
        display: ['Anton', 'sans-serif'],
        sans: ['Inter', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
