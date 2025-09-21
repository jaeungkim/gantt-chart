import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), svgr(), tsconfigPaths()],
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
