import { createMDX } from 'fumadocs-mdx/next';
import fs from 'node:fs';
import path from 'node:path';

const withMDX = createMDX();

const repoRoot = path.resolve(import.meta.dirname, '../..');

// In dev the package name resolves to `src/`, so a library edit hot-reloads without a build.
// Alias values are module specifiers, not paths: an absolute path fails, so keep them relative.
// `src/` imports its own modules bare via the root tsconfig `baseUrl`, which Turbopack ignores.
const domainAliases = Object.fromEntries(
  fs
    .readdirSync(path.join(repoRoot, 'src'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [`${entry.name}/*`, `../../src/${entry.name}/*`])
);

const devAliases = {
  ...domainAliases,
  '@jaeungkim/gantt-chart': '../../src/index.ts',
  '@jaeungkim/gantt-chart/style.css': '../../src/styles.css',
};

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
export default withMDX({
  reactStrictMode: true,
  // Bottom-left is the playground console button, bottom-right is Agentation; top-right is free.
  devIndicators: { position: 'top-right' },
  turbopack: {
    // Turbopack does not resolve outside its root, and in dev the library source is two up.
    root: repoRoot,
    ...(isDev ? { resolveAlias: devAliases } : {}),
  },
});
