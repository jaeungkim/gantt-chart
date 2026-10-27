import { createMDX } from 'fumadocs-mdx/next';
import fs from 'node:fs';
import path from 'node:path';

const withMDX = createMDX();

const repoRoot = path.resolve(import.meta.dirname, '../..');

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

export default withMDX({
  reactStrictMode: true,
  devIndicators: { position: 'top-right' },
  turbopack: {
    root: repoRoot,
    ...(isDev ? { resolveAlias: devAliases } : {}),
  },
  redirects: async () => [
    { source: '/docs/accessibility', destination: '/docs/introduction', permanent: false },
    { source: '/ko/docs/accessibility', destination: '/ko/docs/introduction', permanent: false },
  ],
});
