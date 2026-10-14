# Agent Handoff

## Current Objective

Remove the unused store-mode shopping date on `issue/157-remove-shopping-date` for [#157](https://github.com/sndrem/mealplanner/issues/157).

## Completed

- Store mode no longer shows a Handledato control or a **Før handledato** section.
- Due items are those from today through the end of the meal plans chosen by trip focus. A saved `MealPlan.activeShoppingDate` no longer hides items.
- The database column, `updateActiveShoppingDate`, and per-item buy/postpone dates stay. The check queue still keys off `activeShoppingDate`.

## Files To Read First

- `app/lib/shopping.server.ts` — store-mode window is today through plan end
- `app/routes/family-meal-plan-store-mode.tsx` — Tilpass no longer posts a shopping date
- `app/lib/shopping.server.test.ts` — window expectations

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 702 tests passed
- `npm run typecheck` — passed
- Browser on `http://localhost:5177/families/cms77vj9m0002nk3e9xnzl9cj/store-mode`. Tilpass has Fokus and Butikk, and no Handledato. No **Før handledato** section. Trip focus switched to Denne uken and back to Alle åpne. Checking Kyllingbuljong moved the scan line to 0 igjen, then unchecking restored 1 igjen · 26/27.

## Open Items

- `MealPlan.activeShoppingDate` is still written and still part of the toggle queue key. Dropping the column is a later migration.
- `ShoppingDateSelect` is no longer imported by store mode. Per-item dates still live on the item cards.
- `temp-delete-later/` mockups stay untracked.

## Next Step

Review and merge the pull request for [#157](https://github.com/sndrem/mealplanner/issues/157).
