const { colors } = require('./src/tailwind/colors');
const { fontFamily, fontSize } = require('./src/tailwind/fonts');
const { boxShadow } = require('./src/tailwind/shadows');

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors,
      fontFamily,
      fontSize,
      boxShadow,
    },
  },
};
