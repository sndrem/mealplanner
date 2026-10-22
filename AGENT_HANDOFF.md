# Agent Handoff

## Current Objective

Reload store mode only when the trip changes. Branch `issue/321-store-mode-revision` was cut with `--no-track` from `origin/main` at `373260c` for issue #321.

## Completed

- A visible store-mode screen polls `families/:familyId/store-mode/revision` every 15 seconds. The full trip reloads only when that token changes, when this shopper's toggle queue drains, or when a quantity, category, or heading edit asks for it.
- Root and the app layout stay out of those store-mode reloads. A same-page check no longer reloads the trip by itself.
- One full load reads the covering plan, the anchor graph, shopping display preferences, and membership once.
- A confirmed check stays on screen until the loader shows the same state, so the item does not flip off and back on.

## Files To Read First

- `app/lib/store-mode-trip-revision.server.ts` — the cheap revision token
- `app/lib/store-mode-revalidation.ts` — when to reload the trip, the route, and the parent layouts
- `app/routes/family-meal-plan-store-mode.tsx` — the 15-second poll
- `app/lib/use-store-mode-toggle-sync.ts` — holds a confirmed check until the loader catches up

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 805 tests passed
- `npm run typecheck` — passed after widening the toggle-sync harness item type
- Signed-in store mode: revision requests at about 15, 30, 45, and 60 seconds, and the trip loader did not run again while the token stayed the same. Did not check real items; that writes handlehistorikk.

## Open Items

- A same-millisecond double update with an unchanged count does not move the token. Accepted for two shoppers.
- Local `main` has diverged from `origin/main`. Do not push `main`.

## Next Step

Review and merge the pull request.
