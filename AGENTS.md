# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Copilot, …) working in this repository. Humans: see [README.md](./README.md).

## Project

`@jaeungkim/gantt-chart` — a lightweight React Gantt chart component, published to npm. MIT licensed.

- Built with Vite in library mode: ES + CJS bundles plus bundled `.d.ts` in `dist/`.
- `react` / `react-dom` are peer dependencies (18 or 19) and are externalized from the bundle.
- Runtime deps: `dayjs`, `zustand`, `@tanstack/react-virtual`. Do not add dependencies without a clear need — bundle size matters for consumers.

## Setup

- Node 20 or newer, pnpm 10 (pinned in `package.json#packageManager`; pnpm downloads the pinned version automatically).
- `pnpm install`

## Commands

| Command            | What it does                                     |
| ------------------ | ------------------------------------------------ |
| `pnpm dev`         | Vite dev server with the local playground        |
| `pnpm build`       | Library build to `dist/` (also emits types)      |
| `pnpm lint`        | ESLint over `src/`                               |
| `pnpm lint:fix`    | ESLint with autofix                              |
| `pnpm type-check`  | `tsc --noEmit`                                   |

There is no test suite yet. Before opening a PR run `pnpm lint && pnpm type-check && pnpm build` — all three must pass.

## Layout

```
src/index.tsx        public entry — the only file consumers import from
src/pages/Gantt.tsx  top-level <ReactGanttChart /> component and its GanttProps
src/components/      bars, header, dependency arrows, scale selector
src/hooks/           drag, virtualization, selectors, theme
src/stores/          zustand store
src/utils/           timeline math, arrow paths, data transforms
src/types/           public types (Task, TaskDependency, GanttScaleKey, GanttTheme, …)
src/constants/       scale definitions (gantt.ts)
src/assets/styles/   gantt.css (shipped) and index.css (playground only)
src/main.tsx, src/App.tsx, db.ts   dev playground + sample data — not part of the package
```

`index.html` is the playground shell; `vite.config.ts` excludes the playground files from type emission.

## Conventions

- TypeScript `strict`; no `any`, no `@ts-ignore`.
- Imports resolve from `src/` as the base URL (`import Gantt from "pages/Gantt"`), configured in `tsconfig.json` and `vite-tsconfig-paths`.
- Anything exported from `src/index.tsx` is public API — changing it is a breaking change; update `README.md` and bump the version accordingly.
- Keep changes focused; do not reformat or refactor unrelated code in the same PR.
- Conventional Commits for commit messages (`feat:`, `fix:`, `chore:`, …).
