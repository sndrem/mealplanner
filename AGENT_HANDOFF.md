# Agent Handoff

## Current Objective

Fix auto-merge so linked issues close after a squash merge ([#234](https://github.com/sndrem/mealplanner/issues/234)).

## Completed

- Confirmed `GITHUB_TOKEN` API squash-merges skip GitHub's `Closes #N` handling (same limitation as missing `push` events)
- Auto-merge workflow now closes linked issues after a successful merge (GraphQL `closingIssuesReferences` plus closing keywords in the PR title/body)
- Issue-close failures warn instead of failing the job so Fly deploy still runs
- Branch cut from current `origin/main` after `git pull --ff-only`

## Files To Read First

- `.github/workflows/auto-merge.yml` — merge + explicit issue close
- `docs/deploy-fly.md` — GITHUB_TOKEN merge limitations

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 571 tests passed
- `npm run typecheck` — passed

## Open Items

- This PR's own merge still uses the old workflow on `main`, so #234 may need a manual close after merge
- Manual: next auto-merged PR with `Closes #<n>` should close via `github-actions[bot]`

## Next Step

Review and merge the PR for #234.
