# Agent Handoff

## Current Objective

Hide the meal plan name and date form behind a settings control on the week page (issue #278).

## Completed

- "Oppdater ukeplan" is closed until the header "Innstillinger" button is opened.
- The same `update-meal-plan` form still saves name, start date, and end date.
- The panel stays open while that save is in progress and when it returns field errors or a form error.
- A successful save closes the panel and shows the existing "Ukeplan oppdatert" notice.
- Title and date inputs use `text-base` so iOS does not zoom on focus.

## Files To Read First

- `app/routes/family-meal-plan.tsx` — settings button, `showMealPlanSettings`, and the moved form

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 728 tests passed
- `npm run typecheck` — passed
- Browser: form hidden by default; invalid end date keeps the panel open with the error; a successful rename updates the header, shows the notice, and closes the panel. The temporary title was restored.

## Open Items

- None for this change.

## Next Step

Review and merge the pull request for issue #278.
