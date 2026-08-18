# Agent Handoff

## Current Objective

Open and merge the pull request for the family shopping catalog (issue #189).

## Completed

- Custom quick-add names persist in a family-scoped catalog and show up in typeahead on later lists.
- Handlevarer admin supports rename, default quantity/category, add, and delete.
- Migration backfills historical custom shopping names that are not canonical ingredients.
- Search loaders require family membership and merge catalog + register suggestions.

## Files To Read First

- `app/lib/shopping-catalog.server.ts` - list/search/merge suggestions
- `app/lib/shopping-catalog-write.server.ts` - upsert and admin CRUD
- `app/routes/family-shopping-catalog.tsx` - Handlevarer UI
- `app/components/manual-shopping-quick-add.tsx` - typeahead sources

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — passed (421 tests)
- `npm run typecheck` — passed

## Open Items

- Apply Prisma migration on each environment before using the feature.
- Manual check: add a custom name, start a new week, type it, confirm default quantity, then rename in Handlevarer.
- Issue #189 closes when the PR merges (`Closes #189`).

## Next Step

Review and merge the pull request.
