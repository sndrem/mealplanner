# Agent Handoff

## Current Objective

Store-mode source lines for a single recipe occurrence include the weekday, and say "kommende" when that date is next week.

## Completed

- A generated item used once now reads "fram til fredag 15. mai".
- When `lastDate` falls in the next Oslo calendar week (Monday–Sunday), the line reads "fram til kommende fredag 22. mai".
- Dates in the current week, and dates further out than next week, stay as weekday plus date without "kommende".

## Files To Read First

- `app/components/store-mode-shopping-item-card.tsx` — `formatDateWithWeekdayLabel`
- `app/lib/meal-plan-week.ts` — `getNextCalendarWeekBounds`
- `app/components/store-mode-shopping-item-card.test.tsx` — coming-week vs current-week copy

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 728 tests passed
- `npm run typecheck` — passed
- Browser: not checked. The line is inside the store-mode info panel and depends on today's Oslo week.

## Open Items

- No GitHub issue is linked to this change.
- Manual check: open a single-occurrence item this week and one next week, and confirm the info line.

## Next Step

Review and merge the pull request.
