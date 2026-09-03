# Contributing

Thanks for helping out. This is a one-person hobby project, so small, focused pull requests are the easiest to review.

## Setup

```bash
pnpm install      # pnpm 10 is pinned via "packageManager"; use pnpm, not npm/yarn
pnpm dev          # the site on :3000 - /playground is the harness; landing page and docs too
```

This is a pnpm workspace with two members:

| Path | What it is |
|---|---|
| `.` (repo root) | the published library, `@jaeungkim/gantt-chart`. Entry `src/index.ts`; everything it imports ships. |
| `apps/site/` | the site at <https://gantt.jaeungkim.com> - landing page, playground and docs. Private, never published. |

`pnpm dev` needs no build step. In dev, `apps/site/next.config.mjs` aliases the package name
to `src/`, so a library edit hot-reloads straight into the page. A production build resolves
`workspace:*` to `dist/` as usual, which keeps what Vercel serves identical to what npm serves.

That alias also maps one glob per top-level folder in `src/`, because the library imports its
own modules bare (`bars/components/GanttBar`, `shared/store`) through `baseUrl: "src"` in the
root tsconfig and Turbopack does not read tsconfig paths. The folder list is read off disk, so
a new domain folder needs no edit there.

## The playground

There is one playground, at `/playground`, and it is both the public demo and the surface the
library is developed against. That is deliberate: a private harness and a public demo with the
same job drift apart, and the public one loses - it sat at six switches while the harness had
twenty-six. One page means a new prop is live for readers the same day it is written.

`pnpm dev`, then open <http://localhost:3000/playground>. The chart fills the viewport under the
site navbar; the expand button bottom-left hands it to the browser's Fullscreen API (Esc leaves).
Every switch lives in the console above that button - the gear (Agentation owns bottom-right in
dev).

Every switch is one row in the `CONTROLS` array in `apps/site/components/playground/controls.ts`,
rendered by a single loop in `view.tsx` beside it - add a row, not another block of JSX. `group`
decides which section of the console it lands in. Settings mirror into the query string, so a
scenario is a shareable link (`/playground?groupBy=1&theme=dark`) that still toggles live once
loaded.

The action bar at the top of the console is the only place the imperative ref API is reachable
from the UI, and the event log at the bottom prints every callback the chart fires with its
payload - the fastest way to see what a gesture actually emitted.

The `chart height` switch exists for layout bugs: a short container is where overflow problems
show.

Every demo on the site, the playground included, shares the one fixture in
`apps/site/components/demo/tasks.ts`. Vary the props, never fork the data.

## Source layout

`src/` is grouped by **what a folder is for**, not by what kind of file it holds. A feature's
component, its hooks and its math live in one directory, so the things that change together are
edited together and a feature can be read - or deleted - without hunting through four parallel
trees.

| Folder | Owns |
|---|---|
| `src/core/` | the headless core: tree, calendar, reorder, dates. Plain data and pure functions, no React and no DOM. |
| `src/shared/` | what more than one feature needs: constants, the shared types, the zustand store and its context, i18n formatters, pointer-gesture helpers. |
| `src/timeline/` | the time axis: date↔pixel geometry, the tick/header model, viewport and zoom, virtualization, the header, today line and non-working shading. |
| `src/bars/` | the bars themselves and every bar-level gesture - move, resize, progress, draw-to-create. |
| `src/dependencies/` | dependency links: validation, arrow geometry, the arrow layer, link dragging. |
| `src/rows/` | the row model: grouping, lane packing, collapse, the row layer. |
| `src/task-list/` | the left pane: the grid, its columns and its splitter, plus row reordering. |
| `src/interaction/` | selection, the keyboard map and the aria labels. |
| `src/detail/` | the task detail panel. |
| `src/` (root) | `Gantt.tsx` composes the features, `props.ts` is the public prop surface, `index.ts` is the package barrel. |

Inside a domain, files are split again by what they are - `components/`, `hooks/` and `utils/`.
A domain has only the ones it needs; `interaction/` has no components, `bars/` has no utils.

```
src/timeline/
  components/  GanttChartHeader.tsx  GanttTodayLine.tsx  GanttNonWorkingLayer.tsx
  hooks/       useGanttViewport.ts   useGanttScrollApi.ts  useGanttVirtualization.ts
  utils/       geometry.ts  transform.ts  header.ts  viewport.ts
```

`src/core/` stays flat - it is one cohesive module, not a feature - and `src/shared/` keeps its
five cross-cutting modules (`constants.ts`, `types.ts`, `task.ts`, `store.ts`, `context.ts`) at its
root, with `hooks/` and `utils/` beneath.

Three rules keep it honest:

- **`src/core/` may not import from any of the other folders.** It has to stay runnable in Node, so
  an eslint block scoped to `src/core/**` forbids React, the DOM globals and every domain folder.
  Adding a new domain folder means adding it to that list in `eslint.config.js` - and note the
  patterns are `<domain>/**`, not `<domain>/*`, because of the nesting above.
- **No directory barrels.** Import the file (`shared/constants`, `timeline/utils/geometry`), never
  the directory. A bare barrel specifier survives verbatim into the emitted `.d.ts` and breaks
  every consumer's `tsc`; CI greps `dist/` for exactly that.
- **A file goes in the domain it belongs to, not the one that happens to use it.** `interaction/`
  owns the aria labels even though `bars/` renders them. Cross-domain imports are normal; a
  duplicated helper is not.

Imports are bare and resolved by `baseUrl: "src"` in `tsconfig.json`, so a module's specifier reads
as its address: `bars/hooks/useGanttBarDrag`, `rows/utils/grouping`, `interaction/utils/a11y`.

Tests sit next to what they test, one suite per module.

## Before you open a PR

```bash
pnpm lint
pnpm type-check
pnpm test        # vitest, one suite per module across src/core and the domain folders (pure functions only)
pnpm build
```

CI runs the same four commands on every PR, then builds the docs site and runs an SSR import
smoke test. `pnpm docs:build` runs that last pair locally, and it is the only thing that catches
a page whose MDX no longer parses. There are no component tests, so for visual or drag changes
attach a screenshot or GIF from the playground to the PR.

## Documentation

Prose lives in `apps/site/content/docs/`, as MDX with a `title` and `description` in the
frontmatter. `pnpm --filter @gantt-chart/site build` is what catches a broken page.

- **The two languages are a translation pair.** Every page exists as both `<name>.en.mdx` and
  `<name>.ko.mdx`. A page that exists in only one language is a bug, and touching one means
  touching its twin in the same PR. Prose is translated; code, identifiers, type names and CLI
  commands are not. Korean pages use `-해요체`.
- **Sidebar order** is the `pages` array in `meta.en.json` / `meta.ko.json`, not the filenames.
- **One fact, one owner.** Each fact is explained on exactly one page; every other page gets a
  sentence and a link. `ref/props` is the only place the full prop surface is described.
- **A line may not begin with `import` or `export`** outside a code fence — MDX parses those as
  ESM and the build fails. Wrap the keyword in backticks when a sentence starts with it.
- Add a live demo with `<GanttDemo preset="..." />`; presets live in
  `apps/site/components/demo/gantt-demo.tsx` and all share one fixture.

## Branches, commits, PRs

- Branch from `main`. The branch prefix auto-labels your PR, and the label picks its section in the release notes:
  - `feat/<short-desc>` → `enhancement` (New features)
  - `fix/<short-desc>` → `bug` (Bug fixes)
  - `docs/<short-desc>` → `documentation` (docs-only PRs are labeled by content, any prefix works)
  - `chore/…`, `ci/…` → `skip-changelog` (hidden from release notes)
- Commit messages are free-form. The **PR title** is what matters: it becomes a line in the release notes, so write it for users ("Add `onTaskClick` callback", not "wip").
- PRs are squash-merged into `main` once CI is green.
- Do not bump `version` in `package.json`; releases are cut by the maintainer (see [RELEASING.md](RELEASING.md)).

## Questions

Use [Discussions](https://github.com/jaeungkim/gantt-chart/discussions) for questions and ideas; issues are for bugs and concrete feature requests. Be kind: see the [Code of Conduct](CODE_OF_CONDUCT.md).
