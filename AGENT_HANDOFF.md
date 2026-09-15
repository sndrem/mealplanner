# Agent Handoff

## Current Objective

Stop Chrome’s HTTPS mixed-form warning on grocery grouping (and other POSTs) by using React Router `Form` plus relative action redirects. Branch `fix/react-router-form-https` was cut from current `origin/main` after `git pull --ff-only` (PR #257 already merged).

## Completed

- Grocery grouping toggle uses React Router `Form` instead of a native document POST
- Store-mode and meal-plan shopping notice redirects use relative `Location` via `redirect()`
- Auth login/register/forgot/reset POSTs also use `Form`
- Always-on Cursor rule `.cursor/rules/react-router-form.mdc` (plus pointer in `frontend-standards.mdc`)
- `renderWithRouter` now uses a data router so `<Form>` tests work

## Files To Read First

- `.cursor/rules/react-router-form.mdc` — Form + relative redirect convention
- `app/components/shopping-grocery-grouping-toggle.tsx` — grouping POST
- `app/routes/family-meal-plan-store-mode.tsx` — `buildFamilyStoreModeRedirect`
- `app/test/render-with-router.tsx` — test helper for `<Form>`

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 674 tests passed
- `npm run typecheck` — passed
- Live HTTPS toggle — not re-checked on a deploy

## Open Items

- Other routes still build absolute redirects from `request.url` (`family-shopping.tsx`, `app.tsx`, etc.); they are safe if they already use RR `Form`, but should be converted if touched
- Confirm the grouping toggle on the deployed HTTPS URL after merge

## Next Step

Merge the PR after CI is green, then confirm the grouping toggle on the deployed HTTPS URL.
