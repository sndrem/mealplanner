# Agent Handoff

## Current Objective

Implement issue `#14`'s server-side calendar export flow: family-scoped `.ics` downloads for a whole meal plan and a single day, plus entry points from the meal plan UI.

## Completed

- Added `app/lib/calendar.server.ts` to fetch family-scoped dinner entries, generate timed ICS output for `16:00-17:00` dinners in `Europe/Oslo`, validate requested day exports, and produce download-friendly filenames.
- Added explicit calendar export routes in `app/routes.ts` plus thin loaders in `app/routes/family-meal-plan-calendar.ts` and `app/routes/family-meal-plan-day-calendar.ts`.
- Updated `app/routes/family-meal-plan.tsx` so the meal plan page now shows a whole-plan export action and per-day export links for saved dinner entries, with downloads routed through a hidden iframe so the page does not navigate away.
- Added focused coverage in `app/lib/calendar.server.test.ts`, `app/routes/family-meal-plan-calendar.test.ts`, and `app/routes/family-meal-plan-day-calendar.test.ts`.

## Files To Read First

- `app/lib/calendar.server.ts` - Server-side ICS formatting, meal-plan/day export rules, and family-scoped read behavior.
- `app/routes/family-meal-plan-calendar.ts` - Whole-plan download route and response headers.
- `app/routes/family-meal-plan-day-calendar.ts` - Single-day download route and invalid-day handling.
- `app/routes/family-meal-plan.tsx` - UI links for whole-plan and per-day exports.

## Validation

- `npm run test:run -- app/lib/calendar.server.test.ts app/routes/family-meal-plan-calendar.test.ts app/routes/family-meal-plan-day-calendar.test.ts app/routes/family-meal-plan.test.ts`
- `./node_modules/.bin/tsc --noEmit`

## Open Items

- No manual browser smoke test has been run yet for the new `.ics` downloads from `families/:familyId/meal-plans/:mealPlanId`, including verification that the hidden-iframe download flow keeps the user on the meal plan page and that calendar clients import them as same-day `16:00-17:00` dinners.
- Draft meal plans are currently exportable because calendar routes follow the same family-member read rules as the existing planner and shopping views.
- `npm run typecheck` still needs a Node `>20` environment if you want to verify the full React Router/typegen pipeline instead of plain `tsc --noEmit`.

## Next Step

Run a browser smoke test for whole-plan and single-day `.ics` downloads, then confirm whether product wants to keep draft meal plans exportable or gate exports on approval later.
