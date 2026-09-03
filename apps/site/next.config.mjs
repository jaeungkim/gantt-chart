import { createMDX } from 'fumadocs-mdx/next';
import fs from 'node:fs';
import path from 'node:path';

const withMDX = createMDX();

const repoRoot = path.resolve(import.meta.dirname, '../..');

/**
 * In dev, the package name points at `src/`, not at `dist/`.
 *
 * This site is both the public playground and the dev harness, so `pnpm dev` has to
 * hot-reload a library edit without a build step in between. A production build resolves
 * `workspace:*` to `dist/` as before, so what Vercel serves is still what npm serves.
 *
 * Two things to know if you touch this:
 *
 * 1. An alias value is a module specifier, not a filesystem path. An absolute path is read
 *    as relative and fails with "server relative imports are not implemented yet", so these
 *    stay relative to apps/site.
 * 2. `src/` imports its own modules bare (`bars/components/GanttBar`, `shared/store`, ...)
 *    through `baseUrl: "src"` in the root tsconfig, which Turbopack does not read. One glob
 *    per top-level folder in `src/` covers all of them, and reading the folder list off disk
 *    means adding a domain needs no edit here.
 */
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
  // Next's dev indicator defaults to bottom-left, which is where the playground's console
  // button sits, and the console panel opens up the left edge. Agentation owns bottom-right,
  // so the indicator goes to the one free corner.
  devIndicators: { position: 'top-right' },
  turbopack: {
    // Absolute, and above apps/site: Turbopack does not resolve files outside its root, and
    // in dev the library source is two levels up.
    root: repoRoot,
    ...(isDev ? { resolveAlias: devAliases } : {}),
  },
});
