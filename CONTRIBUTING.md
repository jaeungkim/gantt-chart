# Contributing

Thanks for helping out. This is a one-person hobby project, so small, focused pull requests are the easiest to review.

## Setup

```bash
pnpm install   # pnpm 10 is pinned via "packageManager"; use pnpm, not npm/yarn
pnpm dev       # Vite dev app: index.html -> src/main.tsx -> src/App.tsx, sample data in db.ts
```

The published library is `src/index.tsx` and everything it imports. `src/main.tsx`, `src/App.tsx` and `db.ts` are the dev harness and are not shipped.

## Before you open a PR

```bash
pnpm lint
pnpm type-check
pnpm test        # vitest, pure utils only (src/utils/utils.test.ts)
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
