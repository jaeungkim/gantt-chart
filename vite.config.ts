import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    dts({
      include: ['src'],
      exclude: ['src/main.tsx', 'src/App.tsx', 'db.ts', 'src/**/*.test.ts'],
      rollupTypes: true,
    }),
  ],
  build: {
    copyPublicDir: false, // public/ is for the dev app only; keep it out of dist/ and the npm tarball
    lib: {
      entry: 'src/index.tsx',
      name: '@jaeungkim/gantt-chart',
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
  // For library development - make React available in dev mode
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
