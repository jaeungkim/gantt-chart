# Releasing

Maintainer runbook. Publishing is triggered by creating a GitHub Release in the web UI; nothing runs from a laptop.

## Who can release

- Creating a GitHub Release requires **write** access to this repository.
- `.github/workflows/publish.yml` only runs for Releases created in this repository (forks cannot trigger it).
- npm authenticates the workflow via trusted publishing (OIDC): the `@jaeungkim/gantt-chart` package is bound to `jaeungkim/gantt-chart` + workflow file `publish.yml`. No npm token exists anywhere.
- Optional hardening: a tag ruleset on `v*` restricting create/update/delete to repository admins means even collaborators with write access cannot cut a release. If a second maintainer joins, add a GitHub Environment `npm` with a required reviewer, add `environment: npm` to the `publish` job in `publish.yml`, and set "Environment name" to `npm` in the npm trusted-publisher config — both sides must match.

## One-time setup (web UI, no CLI)

### npmjs.com

1. Account → Two-Factor Authentication: enabled.
2. Package `@jaeungkim/gantt-chart` → Settings → Trusted Publisher → GitHub Actions:
   - Organization or user: `jaeungkim`
   - Repository: `gantt-chart`
   - Workflow filename: `publish.yml` (filename only, with extension, case-sensitive)
   - Environment name: leave blank
   - Allowed actions: `npm publish`

   npm does not validate this on save; a typo shows up as `E404` / `ENEEDAUTH` at publish time.
3. After the first successful OIDC publish: Settings → Publishing access → "Require two-factor authentication and disallow tokens", then revoke any leftover automation tokens.

### GitHub

1. Settings → Advanced Security → Private vulnerability reporting → Enable (SECURITY.md links to it).
2. Settings → General → Pull Requests: only "Allow squash merging"; default commit message "Pull request title"; "Automatically delete head branches".
3. Settings → Rules → Rulesets → New branch ruleset `main`, target = default branch:
   - Restrict deletions, Block force pushes
   - Require a pull request before merging (0 approvals)
   - Require status checks to pass → `build` (from the CI workflow)
   - No bypass list. Every change, including the maintainer's, goes through a PR — auto-generated release notes only see merged PRs.
4. Optional: New tag ruleset, target `v*`: Restrict creations / updates / deletions; bypass = Repository admin.
5. Issues → Labels → New label:
   - `breaking` `#b60205` — "Changes the public API or behavior; bumps the minor version while 0.x"
   - `skip-changelog` `#cfd3d7` — "Hide from release notes (CI, tooling, release chores)"
6. Repo home page → About (gear icon): website `https://gantt.jaeungkim.com`, topics `react gantt gantt-chart timeline typescript`.

## Cutting a release (example: 0.4.0)

1. Version bump PR:

   ```bash
   git switch main && git pull
   git switch -c release/v0.4.0
   pnpm version minor --no-git-tag-version   # patch / minor / major; while 0.x, breaking changes bump minor
   git commit -am "chore: release v0.4.0"
   git push -u origin release/v0.4.0
   ```

   Open the PR (the `release/` prefix auto-labels it `skip-changelog`), wait for CI, squash-merge.

2. GitHub → Releases → **Draft a new release**:
   - Choose a tag: type `v0.4.0` → "Create new tag on publish", target `main`
   - Release title: `v0.4.0`
   - Click **Generate release notes** (sections come from `.github/release.yml`; edit freely)
   - **Publish release**

3. The `Publish` workflow runs: checks the tag matches `package.json` `version`, builds, `npm publish` with OIDC. Provenance is attached automatically.

4. Verify <https://www.npmjs.com/package/@jaeungkim/gantt-chart> shows the new version with the provenance badge.

## If something fails

- Tag/version mismatch: the workflow fails before publishing. Delete the Release and tag, fix, redo step 2.
- npm `E404` / `ENEEDAUTH`: trusted-publisher config mismatch (owner, repo, filename, environment; case-sensitive). Fix on npmjs.com, then Actions → the failed run → Re-run all jobs.
- `EPUBLISHCONFLICT`: that version is already on npm. Nothing to do.
- Publish succeeded but the Release body needs a fix: edit the Release in the UI; it does not re-trigger the workflow (only `published` does).
