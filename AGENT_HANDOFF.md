# Agent Handoff

## Current Objective

Implement issue `#11`'s deterministic shopping projection so generated shopping items come from persisted meal-plan recipes on the server with exact-match merging and focused coverage.

## Completed

- Added `app/lib/shopping.server.ts` with a dedicated meal-plan-scoped shopping projection query, deterministic generated-item source keys, exact-match merge behavior, override application, and store/section ordering.
- Added the first production shopping route in `app/routes/family-meal-plan-shopping.tsx` and registered it in `app/routes.ts` so families can open a read-only server-generated shopping view from a meal plan.
- Expanded focused coverage in `app/lib/shopping.server.test.ts` and `app/routes/family-meal-plan-shopping.test.ts` for projection, merge boundaries, override application, ordering, scoping, and loader serialization.
- Updated `app/routes/family-meal-plan.tsx` with a direct link to the new shopping view.

## Files To Read First

- `app/lib/shopping.server.ts` - Core server-side shopping projection, merge logic, override application, and store grouping.
- `app/routes/family-meal-plan-shopping.tsx` - Read-only shopping projection loader and UI for one meal plan.
- `app/lib/shopping.server.test.ts` - Service-level coverage for deterministic source keys, exact-match merging, overrides, and ordering.
- `app/routes/family-meal-plan.tsx` - Meal-plan detail page entry point linking into the shopping route.

## Validation

- `npm run test:run -- app/lib/shopping.server.test.ts app/routes/family-meal-plan-shopping.test.ts`
- `./node_modules/.bin/tsc --noEmit`

## Open Items

- No manual browser smoke test has been run yet for `families/:familyId/meal-plans/:mealPlanId/shopping`.
- The new production shopping flow is generated-item only; manual shopping items, override mutation actions, checked-state editing, postponement editing, and store-mode UX are still future work.
- Generated source keys are stable for the same merged occurrence set, but a merge bucket changing because entries were added or removed will naturally produce a new key and reset any existing override for that generated row.

## Next Step

Run a manual end-to-end check of the new shopping route from an existing meal plan, then decide whether the next issue should add persisted manual items or override mutation actions first.
