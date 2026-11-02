import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    alias: {
      '@jaeungkim/gantt-chart': fileURLToPath(new URL('src/index.ts', import.meta.url)),
    },
  },
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
