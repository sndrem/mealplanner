# Agent Handoff

## Current Objective

Ship the Fallow dead-code and duplication cleanup. Branch `issue/308-remove-unused-code` was cut from current `origin/main` and also covers issue #309.

## Completed

- Removed the unused React Router welcome scaffold and stopped exporting symbols that nothing imports.
- Left `entry.server.tsx` in place. `.fallowrc.json` adds that server entry, ignores `docs/**` for dead code, and ignores test files for duplication only.
- Moved `parseDateOnly` into `app/lib/meal-plan-dates.ts` and shared family route auth, page chrome, and store-mode mutation results.
- Fallow dead code is 0. With test files ignored, `fallow --summary` reports 51 clone groups and 4.4% duplicated lines.

## Files To Read First

- `.fallowrc.json` — server entry, docs ignore, test-file duplication ignore
- `app/components/family-page.tsx` — shared family page header, banners, and error shells
- `app/lib/family-route.server.ts` — shared loader and action prelude
- `app/lib/meal-plan-dates.ts` — shared `parseDateOnly`

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 759 tests passed
- `npm run typecheck` — passed
- Browser on the logged-in Moldeklev family: freezer, recipes, stores, shopping catalog, meal plans, always-on shopping list, and store mode loaded with the expected headings and actions. Did not submit a form.

## Open Items

- Remaining production clones include a repeated family-shopping-item lookup in `app/lib/family-shopping-write.server.ts`. Optimistic list previews were left in each route.
- Untracked `temp-delete-later/` drafts are not part of this change.

## Next Step

Review the pull request for issues #308 and #309, then merge.
