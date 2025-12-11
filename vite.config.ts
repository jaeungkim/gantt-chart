import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    tsconfigPaths(),
    dts({
      include: ['src'],
      exclude: ['src/main.tsx', 'src/App.tsx', 'db.ts'],
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.tsx',
      name: '@jaeungkim/gantt-chart',
      fileName: (format) => `index.${format}.js`,
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
