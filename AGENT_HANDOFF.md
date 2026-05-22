# Agent Handoff

## Current Objective

Issue #60 — PR ready on branch `issue/60-dedupe-shopping-ingredients`: deduplicate shopping list ingredients across recipes and days, with clear per-meal attribution.

## Completed

- Merge generated shopping lines by canonical ingredient / name + category (not amount or preferred store).
- Sum quantities when the same unit appears across multiple planned meals (e.g. Lasagne Mon + Tue → 2 stk).
- Per-occurrence amounts in Kilder; `preferredStoreConflict` badge when stores differ.
- Legacy `shoppingOverrides` fallback for old single-occurrence `sourceKey`s.
- Store mode and shopping list show every planned meal (e.g. `Lasagne mandag 11. mai og Lasagne tirsdag 12. mai`).
- Shared helpers in `app/lib/shopping-display.ts` + tests.

## Files To Read First

- `app/lib/shopping.server.ts` — merge, sum, overrides
- `app/lib/shopping-display.ts` — occurrence attribution copy
- `app/routes/family-meal-plan-shopping.tsx` — list UI
- `app/routes/family-meal-plan-store-mode.tsx` — store mode UI

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 167 tests passed (32 files)
- `npm run typecheck` — passed

## Open Items

- PR review and merge.
- Manual smoke-test: shared ingredient across recipes, same recipe on two days, store mode attribution.

## Next Step

Merge PR when CI is green.
