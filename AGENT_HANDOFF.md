# Agent Handoff

## Current Objective

Remove the unused week shopping list page (issue #280) so store mode is the only week shopping UI.

## Completed

- Unregistered `/families/:familyId/meal-plans/:mealPlanId/shopping` and its ingredient-search route, and deleted those route modules and tests.
- Removed the week-shopping links from the meal plan header, the store mode header, and generated lines on the family list. "Åpne butikkmodus" is now the emerald action on the meal plan.
- Deleted week-only writes: create/delete manual items, exclude/restore generated lines, and full generated-line edits. Store mode quantity, category, check-off, and family-list edits stay.
- `ShoppingListItemExpanded` now only edits standing family items.

## Files To Read First

- `app/routes.ts` — week shopping routes are gone
- `app/routes/family-meal-plan.tsx` — store mode is the shopping entry
- `app/lib/shopping-write.server.ts` — remaining shared shopping writes

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 695 tests passed
- `npm run typecheck` — passed
- Browser on `http://localhost:5175`: meal plan offers only "Åpne butikkmodus"; store mode header has "Del liste" and "Butikker" and checking Hvetemel persisted in history, then was unchecked again on the family list; family list loads with no week-shopping link; the old week shopping URL and its ingredient-search URL 404.

## Open Items

- Existing week-only manual items can still be checked off or recategorized in store mode, but they can no longer be added, renamed, or deleted.
- Already-excluded generated lines stay excluded. There is no restore control.
- `getMealPlanShoppingData` is unused by routes and still backs `shopping.server.test.ts`.

## Next Step

Review and open a pull request for issue #280.
