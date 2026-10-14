import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    react(),
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
      name: '@jaeungkim/gantt-chart',
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
      formats: ['es', 'cjs'],
    },
    rolldownOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
});
