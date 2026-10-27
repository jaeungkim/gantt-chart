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
    copyPublicDir: false,
    lib: {
      entry: 'src/index.ts',
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
      formats: ['es', 'cjs'],
    },
    rolldownOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: { postBanner: '"use client";' },
    },
  },
});
