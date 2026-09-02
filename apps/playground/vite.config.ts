import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // tsconfigPaths resolves the library's own bare imports (`components/Gantt`, `core`, ...),
  // which come from `baseUrl: "src"` in the root tsconfig.
  plugins: [react(), tsconfigPaths({ projects: [resolve('../../tsconfig.json')] })],
  resolve: {
    alias: {
      // The playground imports the package by its published name so the harness exercises
      // the same entry point a consumer does. In dev that name points at source, not dist,
      // so edits under ../../src hot-reload without a build step.
      '@jaeungkim/gantt-chart/style.css': resolve('../../src/styles.css'),
      '@jaeungkim/gantt-chart': resolve('../../src/index.ts'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
