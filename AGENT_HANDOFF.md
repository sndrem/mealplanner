# Agent Handoff

## Current Objective

Ship calendar event descriptions with recipe ingredients and measurements for [#254](https://github.com/sndrem/mealplanner/issues/254) on `issue/254-calendar-ingredient-descriptions`.

## Completed

- Calendar recipe select now loads ingredients ordered by `sortOrder`/`id`; subscription feed reuses `calendarRecipeSelect`
- Recipe dinner `DESCRIPTION` includes `Ingredienser` (amount, unit, name) above the original method; freezer notes stay note-only
- Empty ingredient lists omit the ingredients section; empty method still falls back to `Ingen beskrivelse.`
- Unit coverage for `createMealPlanCalendarEvent`, meal-plan ICS export, and the live subscription feed
- Local validation passed; branch is ready to push and open a PR with `Closes #254`

## Files To Read First

- `app/lib/calendar.server.ts` — select, description layout, ingredient line formatting
- `app/lib/calendar-subscription.server.ts` — live feed uses the same recipe select and description builder

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 658 tests passed
- `npm run typecheck` — passed
- Phone calendar / subscribed `.ics` visual check — not run (no UI change)

## Open Items

- Confirm on a real phone that a subscribed dinner event shows both sections without truncation
- GitHub will close #254 via `Closes #254` when the PR merges

## Next Step

Push the branch, open the PR, and merge after CI is green.
