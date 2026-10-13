# Agent Handoff

## Current Objective

Keep family recipe cards and week-plan date fields inside their parents on narrow screens (issue #284).

## Completed

- Family recipe cards stack the title above Åpne and Rediger below the `sm` breakpoint, and long titles, descriptions, and tags wrap instead of widening the page.
- Startdato and Sluttdato on Oppdater ukeplan and the create-week-plan form match the Navn field width. Create-form dates are 16px so iOS does not zoom on focus.
- The reminder modal date and time fields use the same width constraint.

## Files To Read First

- `app/routes/family-recipes.tsx` — `RecipeListCard` and the recipe list sections
- `app/routes/family-meal-plan.tsx` — Oppdater ukeplan date fields
- `app/routes/family-meal-plans.tsx` — create-week-plan date fields
- `app/components/recipe-reminder-modal.tsx` — reminder date and time fields

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 695 tests passed
- `npm run typecheck` — passed
- Browser on `http://localhost:5175` at 390px: family recipe cards caused no horizontal scroll, including a long title and tag; Oppdater ukeplan Startdato, Sluttdato, and Navn were all 310px; create-week-plan dates matched Navn; reminder date and time stayed inside the sheet. At 768px the date pair is still two columns, and recipe actions are one row from 640px.

## Open Items

- Chrome responsive mode did not clip the native date text, so the WebKit `datetime-edit` override was not added. iOS Safari was not checked.

## Next Step

Review and merge the pull request for issue #284.
