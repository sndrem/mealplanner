# Agent Handoff

## Current Objective

Stop iOS date and time fields from painting outside their card. The earlier `min-w-0` fix holds in desktop Chrome and still fails in Arc Search on iPhone (issue #284 follow-up).

## Completed

- On WebKit (`-webkit-touch-callout`), date, time, and datetime-local inputs reset `appearance` so they use the same border box as text fields. The native picker still opens on tap.
- Create-week-plan, Oppdater ukeplan, and the reminder modal date grids use `grid-cols-1` (`minmax(0, 1fr)`) below `sm`, and the create-plan column can shrink.

## Files To Read First

- `app/app.css` — the WebKit date-input rule in `@layer base`
- `app/routes/family-meal-plans.tsx` — Opprett ukeplan Startdato and Sluttdato
- `app/routes/family-meal-plan.tsx` — Oppdater ukeplan date fields
- `app/components/recipe-reminder-modal.tsx` — reminder date and time

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 695 tests passed
- `npm run typecheck` — passed
- Browser on `http://localhost:5175` at 390px in desktop Chrome: Startdato, Sluttdato, and Navn are 310px and stay inside the card. Chrome does not apply the WebKit rule (`appearance` stays `auto`). iOS was not rechecked.

## Open Items

- Confirm on an iPhone in Arc Search after deploy. Desktop responsive mode cannot reproduce the overflow.

## Next Step

Review and merge the pull request, then check Opprett ukeplan on an iPhone in Arc Search.
