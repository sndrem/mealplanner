# Agent Handoff

## Current Objective

Ship iOS search-input font-size fix and Cursor rules for ≥16px text inputs (PR #204).

## Completed

- Recipe picker and Oppskriftsbank search inputs use `text-base` (16px) to prevent iOS Safari focus zoom
- Added `.cursor/rules/ios-input-font-size.mdc` and strengthened `frontend-standards.mdc`
- Added `.cursor/rules/issue-implementation-branching.mdc` plus plan/ship skill updates to branch from fresh `main`

## Files To Read First

- `app/components/meal-plan-recipe-picker.tsx` — picker search input classes
- `app/routes/family-meal-plan.tsx` — recipe bank search input
- `.cursor/rules/ios-input-font-size.mdc` — always-on input font rule

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 449 tests passed
- `npm run typecheck` — passed

## Open Items

- PR #204 CI in progress; auto-merge should deploy via the post-auto-merge Fly hook once merged

## Next Step

Wait for PR #204 checks / auto-merge, then smoke-test search focus on iOS Safari.
