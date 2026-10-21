# Agent Handoff

## Current Objective

Ship the store-mode complexity split for issue #311. Branch `issue/311-store-mode-complexity` was cut from current `origin/main` (`8150fd5`) after `git pull --ff-only`.

## Completed

- Opened GitHub issue #311.
- Split the store-mode `action` into one handler per intent in `app/lib/store-mode-action.server.ts`. The route action only dispatches.
- Moved screen state into hooks and the page JSX into store-mode components. Optimistic updates are unchanged.
- Fallow no longer flags `FamilyMealPlanStoreModeRoute` or the store-mode `action`. Functions above the default complexity threshold went from 95 to 92.
- Added `docs/agents/` so agents know how this repo uses GitHub issues, triage labels, and domain docs. `AGENTS.md` points at those files.

## Files To Read First

- `app/routes/family-meal-plan-store-mode.tsx` — thin route: loader, action dispatch, composition
- `app/lib/store-mode-action.server.ts` — intent handlers
- `docs/agents/issue-tracker.md` — GitHub issue conventions for this repo

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 763 tests passed
- `npm run typecheck` — passed
- `npm run build` — passed earlier in this branch
- Logged-in store mode was not clicked through. This browser had no session.

## Open Items

- `StoreModeShoppingItemCard` is still the next complexity hotspot and is out of scope for #311.
- Untracked `temp-delete-later/` drafts are not part of this change.

## Next Step

Review the pull request for issue #311, then merge. GitHub will close the issue from `Closes #311`.
