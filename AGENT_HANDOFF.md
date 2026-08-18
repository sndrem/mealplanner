# Agent Handoff

## Current Objective

Ship alphabetical A–Z sorting for items in store-mode `StoreModeItemGrid`.

## Completed

- `StoreModeItemGrid` sorts items by name (`nb` locale) before render, including the bought-items grid.
- `sortStoreModeItemsByName` lives in `shopping-store-mode-client.ts` with unit tests for name order and `sourceKey` tie-breaking.

## Files To Read First

- `app/routes/family-meal-plan-store-mode.tsx` - `StoreModeItemGrid` sorts its `items` prop
- `app/lib/shopping-store-mode-client.ts` - `sortStoreModeItemsByName` / `compareStoreModeItemsByName`

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — passed (403 tests)
- `npm run typecheck` — passed

## Open Items

- Loader data (`compareProjectedItemsForStoreMode`) still orders within a section by relevant date, then name. The grid re-sorts for display; aisle/section order is unchanged.
- No related GitHub issue was found for this change.

## Next Step

Review and merge the pull request.
