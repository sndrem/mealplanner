# Agent Handoff

## Current Objective

Issue #92 — mobile quick-add bookmark for family shopping on branch `issue/92-mobile-family-shopping-quick-add`. Ready for PR review.

## Completed

- Fixed bottom quick-add dock on mobile (`revealOnFocus`, `autoFocus`, safe-area padding) on `/families/:familyId/shopping`.
- Desktop (`lg+`) keeps inline `ManualShoppingQuickAdd` in the “Legg til vare” card; single mount via `useIsLgViewport`.
- `ManualShoppingQuickAdd` gained `autoFocus` and optional `searchFetcherKey` props.
- Quick-add action tests added to `family-shopping.test.ts`.

## Files To Read First

- `app/routes/family-shopping.tsx` — split mobile dock vs desktop inline layout
- `app/components/manual-shopping-quick-add.tsx` — `autoFocus` / fetcher key props
- `app/lib/use-lg-viewport.ts` — `useIsLgViewport` for responsive single mount

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 246 tests passed (43 files)
- `npm run typecheck` — passed

## Open Items

- PR review and merge; closes #92 on merge via `Closes #92`.
- Manual smoke on iPhone home-screen bookmark: auto-focus may require one tap on iOS Safari.

## Next Step

Merge PR when CI is green.
