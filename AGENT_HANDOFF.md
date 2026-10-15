# Agent Handoff

## Current Objective

Ship [#295](https://github.com/sndrem/mealplanner/issues/295) on `issue/295-extra-meals`: undated extra meals on the weekly plan, included in the shopping list.

## Completed

- Added `MealPlanExtraMeal` and applied migration `20261015120000_add_meal_plan_extra_meal` to the local database.
- The meal plan page has **Ekstra denne uken**: add a recipe, optional note, and remove. Dinner days are unchanged.
- Copying a plan copies extra meals without a day shift. Recipes outside the family are rejected.
- Extra-meal ingredients join the generated shopping list and merge with dinner ingredients. Undated items stay in store mode after earlier dinners are past, and attribution says **Denne uken** instead of a weekday.

## Files To Read First

- `app/components/meal-plan-extra-meals.tsx` — the week-plan section
- `app/lib/meal-plan.server.ts` — add, note, remove, and copy
- `app/lib/shopping.server.ts` — `listGeneratedMealSources` and the store-mode trip window
- `app/lib/shopping-display.ts` — undated attribution

## Validation

- `npm run test:run` — 709 tests passed
- `npx tsc --noEmit` — passed
- `npx eslint` on the touched files — passed
- `npm run prisma:migrate:deploy` — applied the new migration locally
- Live meal-plan UI was not exercised. The app at `http://localhost:5176/` is logged out.

## Open Items

- Not committed or pushed.
- Confirm in the browser: add kyllingsalat under Ekstra denne uken, check the shopping list and store mode, then copy the week.

## Next Step

Log in locally and walk through add, shopping attribution, and copy-week before opening a pull request.
