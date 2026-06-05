# Agent Handoff

## Current Objective

Issue #145 — PR ready on `issue/145-merged-store-list`: store mode shows one merged shopping list across all non-past family meal plans, filtered by the anchor plan’s shopping date.

## Completed

- Refactored `getMealPlanStoreModeData` to aggregate due/later items from every non-past meal plan (draft + approved) using the anchor plan’s `activeShoppingDate`.
- Stamped `mealPlanId` / `mealPlanTitle` on generated and manual projected items for traceability and per-plan actions.
- Store-mode toggle/category actions accept `itemMealPlanId`; toggle queue and UI preferences are family-scoped.
- Header and item cards communicate combined-list context and source meal plan.

## Files To Read First

- `app/lib/shopping.server.ts` — multi-plan aggregation, `buildStoreModeItemsForPlan`, family dedup in store mode
- `app/routes/family-meal-plan-store-mode.tsx` — loader shape, `itemMealPlanId` actions, combined header
- `app/lib/use-store-mode-toggle-sync.ts` — family-scoped queue key and `mealPlanId` on toggle ops

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — passed (52 files, 315 tests)
- `npm run typecheck` — passed

## Open Items

- Manual QA: two overlapping meal plans in store mode; toggle/check items from each plan; change shopping date on anchor and confirm list updates.
- Local `vite.config.ts` port change (5173 → 5174) left unstaged — unrelated to this issue.

## Next Step

Merge PR; issue closes via `Closes #145`.
