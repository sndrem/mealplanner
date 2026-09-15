# Agent Handoff

## Current Objective

Ship grocery grouping toggle for [#256](https://github.com/sndrem/mealplanner/issues/256) on `issue/256-grocery-grouping-toggle`. Branch is ready to push and open a PR with `Closes #256`.

## Completed

- Per-user `groceryGrouping` (`GROUPED` | `SPLIT`, default **GROUPED** / Samme vare) on `UserFamilyShoppingPreference`
- Display-layer grouping within a meal plan by category + normalized name; stored `sourceKey`s unchanged
- Grouped store-mode / shopping-list cards show recipe measurement lines; one tap checks every member
- Trip-focus ALL still shows the same grocery once per week
- Share snapshots use grouped due items when GROUPED is on
- Toggle order: Samme vare first, Hver mengde second

## Files To Read First

- `app/lib/shopping-grocery-grouping.ts` — group key, fold, `isGroupedShoppingItem`
- `app/lib/shopping.server.ts` — applies grouping after projection; progress counts grouped cards
- `app/lib/use-store-mode-toggle-sync.ts` — grouped tap enqueues one op per member

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 674 tests passed
- `npm run typecheck` — passed
- Browser / in-store tap of garlic from three recipes — not run

## Open Items

- Apply Prisma migration `20260915140000_add_shopping_grocery_grouping` on local/prod DBs
- Confirm on a real shopping trip: mixed-unit garlic in one week is one card; two weeks stay two cards
- Quantity edit is hidden on grouped cards (overrides stay on split member rows)

## Next Step

Push the branch, open a PR with `Closes #256`, and merge after CI is green.
