# Agent Handoff

## Current Objective

Implement issue `#9`'s first production meal-plan copy/reuse flow. Users can now create a new meal plan from an existing one, map copied dinner entries and notes into a selected target date range by relative day offset, and keep the change scoped to current meal-planning functionality.

## Completed

- Added `copyMealPlan()` to `app/lib/meal-plan.server.ts` as a dedicated transactional reuse mutation that validates the new range, scopes the source plan to the current family, sets `copiedFromMealPlanId`, copies only dinner entries plus notes, and truncates copied entries that fall outside the new target range.
- Updated `app/routes/family-meal-plans.tsx` so the existing `Opprett ukeplan` form can optionally reuse a previous meal plan via a source selector while preserving the server-first action/notice flow.
- Expanded focused coverage in `app/lib/meal-plan.server.test.ts` and `app/routes/family-meal-plans.test.ts` for relative-offset copying, shorter target truncation, source-plan not found handling, and copy-specific redirects/validation state.

## Files To Read First

- `app/lib/meal-plan.server.ts` - Meal-plan CRUD plus the new `copyMealPlan()` mutation and UTC date helpers used for relative-offset remapping.
- `app/routes/family-meal-plans.tsx` - Meal-plan list/create UI, optional reuse selector, action branching, and copy notice handling.
- `app/lib/meal-plan.server.test.ts` - Fastest reference for range validation, scoped access rules, and copy/truncation behavior.
- `app/routes/family-meal-plans.test.ts` - Loader/action expectations for create vs reuse flows on the list route.

## Validation

- `npm run test:run -- app/lib/meal-plan.server.test.ts app/routes/family-meal-plans.test.ts`
- `npm run lint`
- `./node_modules/.bin/tsc --noEmit`

## Open Items

- No manual browser smoke test has been run yet for the meal-plan list page or copied-plan detail flow.
- Manual shopping items, shopping overrides, and approval state still remain out of scope for copy/reuse; this change only copies dinner entries plus notes.
- The copied plan currently redirects back to the meal-plan list with a success notice. If product later prefers jumping directly into the copied plan, the list-route redirect flow should be revisited.

## Next Step

Run a manual end-to-end check of `families/:familyId/meal-plans` to verify reusing a source plan, then open the copied plan and confirm dinners/notes landed on the expected target dates before moving on to approval or shopping-generation work.
