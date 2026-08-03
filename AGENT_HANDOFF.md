# Agent Handoff

## Current Objective

Issue #160 — Allow meal plans longer than 7 days (up to 14), on branch `issue/160-allow-meal-plans-longer-than-7-days`.

## Completed

- Raised `MEAL_PLAN_MAX_SPAN_DAYS` to 14 and centralized max-span validation/UI copy via `getMealPlanMaxSpanMessage()`.
- `updateMealPlan` now prunes out-of-range entries and clamps manual buy-on / postpone dates in a transaction.
- Auto-fill exclusion switched from “last 2 plans” to a 14-day calendar lookback before the plan start.
- Planning UI shows week-chunk separators when a plan has more than 7 days; create/edit/home copy updated.

## Files To Read First

- `app/lib/meal-plan.server.ts` — span cap, prune-on-shrink, auto-fill lookback
- `app/routes/family-meal-plan.tsx` — week separators + edit-range copy
- `app/routes/family-meal-plans.tsx` — create/copy max-span and copy-truncation notes
- `app/routes/family.tsx` — kalenderuke home copy

## Validation

- `npx vitest run app/lib/meal-plan.server.test.ts app/routes/family-meal-plans.test.ts` — passed (48 tests)
- `npx tsc --noEmit -p tsconfig.json` — passed
- Manual create/shrink/home smoke — not run yet

## Open Items

- Open PR targeting `main` with `Closes #160` when ready
- Optional: manual smoke of 14-day create, shrink prune, and family home kalenderuke

## Next Step

Push branch and open a PR for #160.
