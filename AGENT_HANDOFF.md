# Agent Handoff

## Current Objective

Ship the family iCal subscription feed ([#239](https://github.com/sndrem/mealplanner/issues/239)): commit, push, and open a PR.

## Completed

- Family-level live iCal feed at `GET /c/:token/calendar.ics` behind a hashed token
- ADMIN Familie-tab card to create, copy HTTPS + webcal URLs, rotate, and revoke
- Existing cookie-gated week/day `.ics` downloads unchanged
- Branch cut from current `origin/main` after `git pull --ff-only`

## Files To Read First

- `app/lib/calendar-subscription.server.ts` — token CRUD and 14-day feed query
- `app/routes/calendar-subscription.ts` — public unauthenticated ICS route
- `app/components/family-calendar-subscription-card.tsx` — subscribe UI

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 590 tests passed
- `npm run typecheck` — passed
- Browser subscribe flow (iPhone `webcal://`, Google From URL) — not run

## Open Items

- Apply migration `20260901140000_add_calendar_subscription` on deploy/local DB
- Manual after merge: subscribe from iPhone and Google Calendar; refresh is not instant

## Next Step

Merge the PR for #239 and confirm the migration runs in the usual deploy path.
