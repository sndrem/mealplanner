# Agent Handoff

## Current Objective

Ship [#293](https://github.com/sndrem/mealplanner/issues/293) on `issue/293-multi-recipe-metadata`: grouped store-mode items should show each recipe use once, as date, recipe, and amount.

## Completed

- Grouped generated store-mode cards no longer render the `Ukeplan:` / `Brukt i` sentence when the occurrence list is already visible.
- Single-recipe, family, and manual source lines are unchanged. The week title, quantity badge, and recipe-count badge stay.
- Frontend standards now require `wrap-break-word` instead of `break-words`.

## Files To Read First

- `app/components/store-mode-shopping-item-card.tsx` — source paragraph is skipped when `showGroupedMeasurements` is true
- `app/components/store-mode-shopping-item-card.test.tsx` — grouped card asserts occurrence lines and the absent summary
- `.cursor/rules/frontend-standards.mdc` — `wrap-break-word` convention

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 702 tests passed
- `npm run typecheck` — passed
- Live store mode was not opened. No dev server was running.

## Open Items

- `temp-delete-later/` mockups stay untracked.
- Existing `break-words` classes were not rewritten to `wrap-break-word`.

## Next Step

Review and merge the pull request for [#293](https://github.com/sndrem/mealplanner/issues/293).
