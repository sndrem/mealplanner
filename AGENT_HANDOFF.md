# Agent Handoff

## Current Objective

Agent steering from the #314 retrospective is on `agent-steering-retro`, cut with `--no-track` from current `origin/main` (`89e6450`, the merged #315). Local `main` was left as it was.

## Completed

- A diverged local `main` branches with `git switch -c issue/<number>-<slug> --no-track origin/main`, so a plain `git push` does not update `main`.
- `AGENTS.md` points at `createCookie` from `react-router` and at `docs/agents/browser-checks.md`.
- Store-mode browser checks use an already finished section or a fresh document request. Checking an item appends handlehistorikk that undo leaves in place.
- Terms an issue names go in `GLOSSARY.md` and ship with that issue. The ship skill writes the pull request body from the `pr` skill.
- The personal TDD skill now treats an order assertion as tautological when the input is already in the asserted order. That file lives outside this repo.

## Files To Read First

- `.cursor/rules/issue-implementation-branching.mdc` — diverged `main` and `--no-track`
- `docs/agents/browser-checks.md` — how to check store mode on the dev server
- `AGENTS.md` — cookie and browser pointers

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 776 tests passed
- `npm run typecheck` — passed

## Open Items

- `GLOSSARY.md` is on this branch. It was written for #314 and missed that pull request.
- No GitHub issue is tied to this branch.

## Next Step

Review and merge https://github.com/sndrem/mealplanner/pull/316.
