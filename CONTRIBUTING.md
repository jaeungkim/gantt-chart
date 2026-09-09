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
| `.` (repo root) | the published library, `@jaeungkim/gantt-chart`. Entry `src/index.ts`. Everything it imports ships. |
| `apps/site/` | the site at <https://gantt.jaeungkim.com>, with the landing page, playground and docs. Private, never published. |

`pnpm dev` needs no build step. In dev, `apps/site/next.config.mjs` aliases the package name
to `src/`, so a library edit hot-reloads straight into the page. A production build resolves
`workspace:*` to `dist/`, which keeps what Vercel serves identical to what npm serves.

That alias also maps one glob per top-level folder in `src/`. The library imports its own
modules bare (`bars/components/GanttBar`, `shared/store`) through `baseUrl: "src"` in the root
tsconfig, and Turbopack does not read tsconfig paths. The folder list is read off disk, so a
new domain folder needs no edit there.

## The playground

There is one playground, at `/playground`, and it is both the public demo and the surface the
library is developed against. A private harness and a public demo with the same job drift
apart, so a new prop is live for readers the same day it is written.

Run `pnpm dev`, then open <http://localhost:3000/playground>. The chart fills the viewport under
the site navbar. The fullscreen button at the right end of the toolbar strip pins the chart over
the viewport, and Esc leaves. It is an overlay rather than the browser's Fullscreen API, so the
exit control stays visible.

Every switch is in the console, which opens from the toggle beside that button and drops below
the strip. Next's dev indicator is pinned top-right in `next.config.mjs`, because the other
corners are in use.

Every switch is one row in the `CONTROLS` array in `apps/site/components/playground/controls.ts`,
rendered by a single loop in `view.tsx` beside it. Add a row rather than another block of JSX.
`group` picks the console section it appears in. Settings mirror into the query string, so a
scenario is a shareable link (`/playground?hierarchy=1&theme=dark`) that still toggles live once
loaded.

The console's action bar reaches the whole imperative ref API. The strip repeats the three calls
that need no task id.

The `chart height` switch exists for layout bugs, since a short container is where overflow
problems show.

Every demo on the site, the playground included, shares the one fixture in
`apps/site/components/demo/tasks.ts`. Vary the props instead of forking the data.

## Source layout

`src/` is grouped by what a folder is for rather than by what kind of file it holds. A feature's
component, its hooks and its math are in one directory, so the things that change together are
edited together. A feature can be read or deleted in one place instead of four parallel trees.

| Folder | Owns |
|---|---|
| `src/core/` | the headless core: tree, calendar, reorder, dates. Plain data and pure functions, no React and no DOM. |
| `src/shared/` | what more than one feature needs: constants, the shared types, the zustand store and its context, i18n formatters, pointer-gesture helpers. It sits below the domains and never imports one. |
| `src/timeline/` | the time axis: date and pixel geometry, the tick/header model, viewport and zoom, virtualization, the header, today line and non-working shading. |
| `src/bars/` | the bars themselves and every bar-level gesture: move, resize, progress, draw-to-create. |
| `src/dependencies/` | dependency links: validation, arrow geometry, the arrow layer, link dragging. |
| `src/rows/` | the row model: lane packing, collapse, the row layer. |
| `src/task-list/` | the left pane: the grid, its columns and its splitter, plus row reordering. |
| `src/interaction/` | selection, the keyboard map and the aria labels. |
| `src/detail/` | the task detail panel. |
| `src/` (root) | `Gantt.tsx` composes the features, `useGanttSelectors.ts` is the store subscription it renders from, `props.ts` is the public prop surface, `index.ts` is the package barrel, `styles.css` is the published stylesheet. |

Inside a domain, files are split again by what they are: `components/`, `hooks/` and `utils/`.
A domain has only the ones it needs. `interaction/` has no components and `bars/` has no utils.
`src/timeline/` uses all three. The listing below leaves some files out.

```
src/timeline/
  components/  GanttChartHeader.tsx  GanttTodayLine.tsx  GanttNonWorkingLayer.tsx
  hooks/       useGanttViewport.ts   useGanttScrollApi.ts  useGanttVirtualization.ts
  utils/       geometry.ts  transform.ts  header.ts  viewport.ts
```

`src/core/` stays flat, one cohesive module rather than a feature. `src/shared/` keeps its five
cross-cutting modules (`constants.ts`, `types.ts`, `task.ts`, `store.ts`, `context.ts`) at its
root, with `hooks/`, `utils/` and `virtual/` beneath.

Four rules apply:

- `src/core/` may not import from any of the other folders. It has to stay runnable in Node, so an
  eslint block scoped to `src/core/**` forbids React, zustand, the DOM globals, the root modules
  and every domain folder. Both lists are read off `src/` at lint time rather than typed out, so
  a new folder or root module is covered the day it appears. The domain patterns are `<domain>/**`
  rather than `<domain>/*`, because of the nesting above, and a root module is restricted in both
  its bare and its relative spelling.
- Do not add directory barrels. Import the file (`shared/constants`, `timeline/utils/geometry`)
  rather than the directory. A bare barrel specifier survives verbatim into the emitted `.d.ts` and
  breaks every consumer's `tsc`. CI greps `dist/` for it.
- A file goes in the domain it belongs to, rather than the one that happens to use it.
  `interaction/` owns the aria labels even though `bars/` renders them. Cross-domain imports are
  normal. Do not duplicate a helper to avoid one, and do not promote a helper to `src/shared/`
  just because a second domain reached for it. A helper with a clear owner keeps that owner.
  What does move to `src/shared/` is vocabulary with no owning feature: a type or constant that
  several domains and the store all speak. `LinkAnchor` lives there for that reason, even though
  only `dependencies/` produces one, because `shared/store.ts` holds the drag draft and `shared/`
  may not import a domain.
- Imports run one way. `core/` imports nothing of ours, `shared/` imports only `core/`, and
  domains import `core/`, `shared/` and each other. Within a domain, keep the module graph
  acyclic. Two files that need each other are usually one file.

Imports are bare and resolved by `baseUrl: "src"` in `tsconfig.json`, so a module's specifier is
its path under `src/`: `bars/hooks/useGanttBarDrag`, `rows/utils/rows`, `interaction/utils/a11y`.

Tests sit in the folder of the code they cover, named after the module they cover. A module
large enough to test along separate axes may carry more than one suite, with the axis after the
module name: `geometry.test.ts`, `geometry.drag.test.ts`, `geometry.timezone.test.ts`.

## Before you open a PR

```bash
pnpm lint
pnpm type-check
pnpm test        # vitest, across src/core and the domain folders (pure functions only)
pnpm build
```

CI runs the same four commands on every PR, then builds the docs site and runs an SSR import
smoke test. `pnpm docs:build` runs the library build and the docs site build locally. The SSR
smoke test runs only in CI. There are no component tests, so for visual or drag changes attach a
screenshot or GIF from the playground to the PR.

## Documentation

Prose is in `apps/site/content/docs/`, written as MDX with a `title` and `description` in the
frontmatter. `pnpm docs:build` is what catches a page whose MDX no longer parses.

- The frontmatter `title` renders as the page's `<h1>`. Do not write one in the body.
- The two languages are a translation pair. Every page exists as both `<name>.en.mdx` and
  `<name>.ko.mdx`. A page that exists in only one language is a bug, and touching one means
  touching its twin in the same PR. Prose is translated. Code, identifiers, type names and CLI
  commands stay in English. Korean pages use `-해요체`.
- Sidebar order is the `pages` array in `meta.en.json` / `meta.ko.json` rather than the
  filenames.
- A new reference page must be listed in `ref/meta.en.json` and `ref/meta.ko.json`, which are
  separate files from the root `meta.en.json` / `meta.ko.json`.
- Each fact is explained on one page, and every other page gets a sentence and a link.
  `ref/props` describes the full prop surface. No other page repeats it.
- A line may not begin with `import` or `export` outside a code fence. MDX parses those as ESM
  and the build fails. Wrap the keyword in backticks when a sentence starts with it.
- Internal links carry no extension. Write `[Task data](../task-data)` rather than
  `task-data.md` or `task-data.mdx`.
- Do not end a page with a `Next:` line. The site renders its own previous/next footer from the
  `pages` array, so a manual one duplicates it and goes stale the moment a page moves.
- Add a live demo with `<GanttDemo preset="..." />`. Presets are in
  `apps/site/components/demo/gantt-demo.tsx` and all share one fixture.

## Branches, commits, PRs

- Branch from `main`. The branch prefix auto-labels your PR, and the label picks its section in the release notes:
  - `feat/<short-desc>` gets the `enhancement` label, under New features.
  - `fix/<short-desc>` gets the `bug` label, under Bug fixes.
  - `release/`, `chore/` and `ci/` prefixes get `skip-changelog`, which is hidden from the release notes.
  - `documentation` is applied when every changed file is `.md` or `.mdx`, whatever the branch prefix is.
- Commit messages are free-form. The PR title becomes a line in the release notes, so write it for users, like "Add `onTaskClick` callback" rather than "wip".
- PRs are squash-merged into `main` once CI is green.
- Do not bump `version` in `package.json`. The maintainer cuts releases (see [RELEASING.md](RELEASING.md)).

## Questions

Use [Discussions](https://github.com/jaeungkim/gantt-chart/discussions) for questions and ideas. Issues are for bugs and concrete feature requests. Be kind, and read the [Code of Conduct](CODE_OF_CONDUCT.md).
