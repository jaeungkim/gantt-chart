# Contributing

Thanks for helping out. This is a one-person hobby project, so small, focused pull requests are the easiest to review.

## Setup

```bash
pnpm install   # pnpm 10 is pinned via "packageManager"; use pnpm, not npm/yarn
pnpm dev       # Vite playground on :5173 (runs the workspace package in playground/)
pnpm docs      # the documentation site on :3000 (apps/docs)
```

This is a pnpm workspace with three members:

| Path | What it is |
|---|---|
| `.` (repo root) | the published library, `@jaeungkim/gantt-chart`. Entry `src/index.tsx`; everything it imports ships. |
| `playground/` | the dev harness. Private, never published. |
| `apps/docs/` | the documentation site at <https://gantt.jaeungkim.com>. Private, never published. |

`apps/docs` consumes the library through `workspace:*`, which resolves to `dist/`, so run
`pnpm build` at the root once before `pnpm docs`.

The playground imports the library by its published name, `@jaeungkim/gantt-chart`, the same
way a consumer does. In dev that name is aliased to `src/` so edits hot-reload without a build.

Every switch in the playground toolbar is one row in the `CONTROLS` array in
`playground/src/App.tsx` - add a row, not another block of JSX. Settings mirror into the query
string, so a scenario is a shareable link (`?criticalPath=1&policy=shift-on-overlap`).

## Before you open a PR

```bash
pnpm lint
pnpm type-check
pnpm test        # vitest, 20 suites across src/core, src/utils, src/hooks and src/stores (pure functions only)
pnpm build
```

CI runs the same four commands on every PR. There are no component tests, so for visual or drag changes attach a screenshot or GIF from the dev app to the PR.

## Documentation

Prose lives in `apps/docs/content/docs/`, as MDX with a `title` and `description` in the
frontmatter. `pnpm --filter @gantt-chart/docs build` is what catches a broken page.

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
  `apps/docs/components/gantt-demo.tsx` and all share one fixture.

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
