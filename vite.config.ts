import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    dts({
      include: ['src'],
      exclude: ['src/**/*.test.*'],
      bundleTypes: true,
    }),
  ],
  build: {
    copyPublicDir: false, // public/ holds README artwork only
    lib: {
      entry: 'src/index.ts',
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
      formats: ['es', 'cjs'],
    },
    rolldownOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      // RSC hosts must load the bundle as a client module. postBanner lands after minification.
      output: { postBanner: '"use client";' },
    },
  },
});
