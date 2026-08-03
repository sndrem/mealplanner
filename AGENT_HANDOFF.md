# Agent Handoff

## Current Objective

Issue #160 — Allow meal plans longer than 7 days (up to 14), on branch `issue/160-allow-meal-plans-longer-than-7-days`. PR #161.

## Completed

- Raised `MEAL_PLAN_MAX_SPAN_DAYS` to 14 and centralized max-span validation/UI copy via `getMealPlanMaxSpanMessage()`.
- `updateMealPlan` now prunes out-of-range entries and clamps manual buy-on / postpone dates in a transaction.
- Auto-fill exclusion switched from “last 2 plans” to a 14-day calendar lookback before the plan start.
- Planning UI shows week-chunk separators when a plan has more than 7 days; create/edit/home copy updated.
- Fixed CI build failure: moved `MEAL_PLAN_MAX_SPAN_DAYS` / `getMealPlanMaxSpanMessage` to client-safe `meal-plan-dates.ts` so route components no longer import `.server` for UI copy.

## Files To Read First

- `app/lib/meal-plan-dates.ts` — shared max-span constant/message
- `app/lib/meal-plan.server.ts` — span cap, prune-on-shrink, auto-fill lookback
- `app/routes/family-meal-plan.tsx` — week separators + edit-range copy
- `app/routes/family-meal-plans.tsx` — create/copy max-span and copy-truncation notes

## Validation

- `npm run prisma:generate` — passed (earlier ship run)
- `npm run lint` — passed (earlier ship run)
- `npm run test:run` — passed earlier; targeted re-run after fix passed (51 tests)
- `npm run typecheck` — passed after fix
- `npm run build` — passed after fix
- Manual create/shrink/home smoke — not run yet

## Open Items

- Confirm CI Validate on PR #161 goes green after push
- Optional: manual smoke of 14-day create, shrink prune, and family home kalenderuke
- Merge PR when review is complete (issue closes via `Closes #160`)

## Next Step

Wait for CI on PR #161, then merge.
