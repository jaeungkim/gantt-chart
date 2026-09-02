# Contributing

Thanks for helping out. This is a one-person hobby project, so small, focused pull requests are the easiest to review.

## Setup

```bash
pnpm install   # pnpm 10 is pinned via "packageManager"; use pnpm, not npm/yarn
pnpm dev       # Vite playground on :5173 (runs the workspace package in playground/)
```

This is a pnpm workspace with two members:

| Path | What it is |
|---|---|
| `.` (repo root) | the published library, `@jaeungkim/gantt-chart`. Entry `src/index.tsx`; everything it imports ships. |
| `playground/` | the dev harness. Private, never published. |

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
