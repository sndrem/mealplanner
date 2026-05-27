# Agent Handoff

## Current Objective

Issue #94 on branch `issue/94-shopping-list-grouping`: merge duplicate generated shopping ingredients across recipes and show a recipe-count badge in shopping list UIs.

## Completed

- Updated generated shopping grouping in `app/lib/shopping.server.ts` to merge by `categoryId + normalized displayName + unit`, instead of relying on `ingredientId`.
- Added `recipeCount` to generated projected items and populated it from distinct contributing recipes.
- Added `N oppskrifter` badges in both shopping list UIs (`family-meal-plan-shopping` and store mode card) when a generated item comes from more than one recipe.
- Extended and updated shopping server tests for merge behavior across different ingredient records and for new `recipeCount` assertions.
- Updated route test fixtures to include `recipeCount` for generated items.

## Files To Read First

- `app/lib/shopping.server.ts` - generated merge key + projected generated item shape (`recipeCount`)
- `app/routes/family-meal-plan-shopping.tsx` - main shopping list badge rendering
- `app/components/store-mode-shopping-item-card.tsx` - store mode badge rendering
- `app/lib/shopping.server.test.ts` - grouping and regression coverage

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — passed (247 tests, 43 files)
- `npm run typecheck` — passed

## Open Items

- Open PR for issue #94 and merge after review/CI.
- Manual UI smoke-check recommended for `/families/:familyId/meal-plans/:mealPlanId/shopping` and `/families/:familyId/meal-plans/:mealPlanId/store-mode` to confirm the new badge copy and placement.

## Next Step

Create and ship the PR for issue #94 (`Closes #94`) and verify CI plus manual shopping-list behavior for duplicate ingredients.
