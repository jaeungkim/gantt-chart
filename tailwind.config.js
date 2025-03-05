import colors from './src/tailwind/colors.js';
import fontFamily from './src/tailwind/fonts.js';
import fontSize from './src/tailwind/fonts.js';
import boxShadow from './src/tailwind/shadows.js';


/** @type {import('tailwindcss').Config} */
const config = {
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

export default config;