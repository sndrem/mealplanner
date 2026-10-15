# Agent Handoff

## Current Objective

Ship [#296](https://github.com/sndrem/mealplanner/issues/296) on `issue/296-recipe-urgency`: an optional store-mode mark for how soon an unbought recipe item is needed. The branch was cut from current `origin/main`.

## Completed

- Tilpass → Visning has **Farge etter bruk**. It is off until turned on, and the choice is stored per family in `localStorage`.
- Unchecked generated items use `firstDate`: a strong left edge plus `i dag` or `i morgen` for today and tomorrow, a lighter edge for 2–4 days, and the normal card otherwise.
- Checked, postponed, manual, family, undated extra-meal, and recently added rows stay plain. The shared list is unchanged.

## Files To Read First

- `app/lib/store-mode-recipe-urgency.ts` — the day buckets
- `app/components/store-mode-shopping-item-card.tsx` — edge and label
- `app/routes/family-meal-plan-store-mode.tsx` — the Tilpass toggle
- `app/lib/shopping-store-mode-client.ts` — the saved preference

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 722 tests passed
- `npm run typecheck` — passed
- On `http://localhost:5176/` the soon edge computes to a 4px `#115e59` left border, and the upcoming edge is a 50% accent left border. Store mode was not clicked through because the homepage is logged out.

## Open Items

- Confirm in a logged-in phone-width store-mode list: turn the toggle on, check tomorrow versus a later-week item, and confirm bought and postponed rows stay plain.
- Untracked `temp-delete-later/` drafts are not part of this change.
- The already-running server on port 5176 has a separate Prisma error (`Unknown field extraMeals`) on the meal-plan loader.

## Next Step

Review the pull request for #296.
