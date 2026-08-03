# Agent Handoff

## Current Objective

Issue #164 — Auto-generate `Uke N` title from Opprett ukeplan date range, on branch `issue/164-auto-uke-title`.

## Completed

- Added `getIsoWeekNumber`, `formatMealPlanAutoTitle`, `resolveAutoMealPlanTitle`, and `getNextCalendarWeekBounds` in `meal-plan-week.ts`.
- Prefills create form with next Oslo calendar week and syncs title from `startDate` unless the user customized it.
- Reordered Opprett ukeplan to dates → Navn → source copy via controlled `CreateMealPlanForm`.

## Files To Read First

- `app/lib/meal-plan-week.ts` — ISO week / auto-title helpers and next-week bounds
- `app/routes/family-meal-plans.tsx` — `CreateMealPlanForm` and form field order
- `app/lib/meal-plan-week.test.ts` — coverage for week number, title resolve, next week

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — passed (354 tests)
- `npm run typecheck` — passed
- `npm run build` — passed

## Open Items

- Manual UI smoke after merge: prefilled next week + title, customize title then change dates, clear title then change dates, validation re-show, create-from-copy

## Next Step

Merge PR after CI is green (issue closes via `Closes #164`).
