# Agent Handoff

## Current Objective

Issue `#36` stock ingredients (basisvarer) is implemented: family registry, shopping projection skip, weekly opt-in via overrides, and UI on Handleliste / Butikkmodus / family settings.

## Completed

- Added `FamilyStockIngredient` model and `ShoppingItemOverride.includeDespiteStock` (migration `20260516173423_add_family_stock_ingredients`).
- Added `app/lib/stock.server.ts`, `app/lib/stock-write.server.ts`, and `app/lib/ingredient-normalize.ts`.
- Updated `app/lib/shopping.server.ts` to skip stock items in generated projection and expose `getStockIngredientsForMealPlan`.
- Added `optInStockShoppingItems` in `app/lib/shopping-write.server.ts`.
- Added route `families/:familyId/stock-ingredients` and family dashboard link.
- Handleliste shows expandable basisvarer notice with per-item and bulk opt-in; Butikkmodus links to Handleliste when stock items are in play.

## Files To Read First

- `app/lib/shopping.server.ts` — projection skip + stock summary.
- `app/lib/shopping-write.server.ts` — `optInStockShoppingItems`.
- `app/routes/family-stock-ingredients.tsx` — admin basisvarer management.
- `app/routes/family-meal-plan-shopping.tsx` — opt-in UI on Handleliste.

## Validation

- `npm run test:run -- app/lib/stock.server.test.ts app/lib/stock-write.server.test.ts app/lib/shopping.server.test.ts app/lib/shopping-write.server.test.ts app/routes/family-stock-ingredients.test.ts app/routes/family-meal-plan-shopping.test.ts app/routes/family-meal-plan-store-mode.test.ts`
- `./node_modules/.bin/tsc --noEmit`

## Open Items

- Manual smoke: configure basisvarer, plan meals with staples, confirm Handleliste exclusion, opt in one item, verify store mode and persistence after reload.
- Display-name matching requires exact normalized names (documented in UI copy).

## Next Step

Manual QA in browser, then open PR for issue #36 if satisfied.
