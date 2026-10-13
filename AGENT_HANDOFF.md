# Agent Handoff

## Current Objective

Remove the one-off week and day ICS file downloads from the meal plan. Calendar access stays on the family subscription feed.

## Completed

- The meal plan header no longer shows "Eksporter ukeplan (.ics)" or the disabled placeholder.
- An open day no longer shows "Eksporter dag (.ics)", and the hidden download iframe is gone.
- The week and day `calendar.ics` routes, handlers, tests, and export-only helpers are removed.
- `c/:token/calendar.ics` and the shared ICS builders used by the subscription remain.

## Files To Read First

- `app/routes/family-meal-plan.tsx` — header subscribe link, no export control
- `app/components/meal-plan-week-entries-form.tsx` — open day without a day export
- `app/lib/calendar.server.ts` — shared ICS builders only
- `app/routes.ts` — subscription route kept, download routes removed

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 719 tests passed
- `npm run typecheck` — passed
- Browser on the local meal plan "Uke 43": header has "Abonner i kalenderen" and no week export. Opening Monday shows the dinner editor and no day export.
- Authenticated requests to the old week and day `calendar.ics` URLs return 404. The family tab still renders the subscription card.

## Open Items

- A bookmarked week or day `.ics` URL now 404s. That is intended.

## Next Step

Review and merge the pull request for issue 279.
