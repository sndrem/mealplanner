# Agent Handoff

## Current Objective

Issue #58 on branch `issue/58-collapse-recipe-bank-mobile` — collapse Oppskriftsbank on mobile to cut vertical scrolling on the meal plan page.

## Completed

- Mobile-only `<details>` for Oppskriftsbank (collapsed by default) with title, recipe count, and Åpne/Lukk affordance.
- Desktop `lg+` block stays always visible via `hidden lg:block`.
- Shared `RecipeBankContent` component to avoid duplicating recipe cards and admin link.

## Files To Read First

- `app/routes/family-meal-plan.tsx` — Oppskriftsbank article, `RecipeBankContent`, `formatRecipeCount`

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 160 tests passed (31 files)
- `npm run typecheck` — passed

## Open Items

- PR merge and manual mobile smoke-test (~390px): collapsed on load, expand/collapse, «I planen» badges when expanded.
- Unrelated local changes (README, package.json, vite.config) were not included in the commit.

## Next Step

Merge PR when CI is green; confirm Oppskriftsbank behavior at mobile and desktop breakpoints.
