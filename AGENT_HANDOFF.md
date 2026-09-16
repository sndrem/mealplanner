# Agent Handoff

## Current Objective

Ship store-mode live list sync (#265) on `issue/265-store-mode-live-revalidate`. Validation passed; next step is merge of the PR.

## Completed

- Added `useVisibleIntervalRevalidate` so store mode reloads every 4s while the tab is visible
- Paused polling during navigation, revalidation, and in-flight toggle/quantity/category fetchers
- Revalidate immediately when the tab becomes visible again, and when the browser comes back online
- Hook unit tests cover interval, pause, hidden, visibility, online, and unmount

## Files To Read First

- `app/lib/use-visible-interval-revalidate.ts` — visible-tab polling hook
- `app/routes/family-meal-plan-store-mode.tsx` — wiring and pause conditions
- `app/lib/use-visible-interval-revalidate.test.ts` — hook coverage

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 692 tests passed (96 files)
- `npm run typecheck` — passed
- Two-phone store-mode check was not run (no logged-in browser pair in this session)

## Open Items

- Confirm on two real devices that a check on one phone appears on the other within a few seconds without refresh
- Confirm locking a phone pauses polling and unlocking refreshes the list
- Shared token lists (`/s/:token`) stay local snapshots by design

## Next Step

Review and merge the PR for #265 after a two-device store-mode check in the aisle or with two browsers.
