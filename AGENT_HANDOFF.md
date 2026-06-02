# Agent Handoff

## Current Objective

Issue #130 on branch `issue/130-redirect-authenticated-users-app`: redirect authenticated users away from `/login` to `/app`.

## Completed

- Extended `requireAnonymous` to support an explicit authenticated redirect target.
- Updated login route loader and action to force authenticated traffic to `/app`.
- Added login loader coverage for unauthenticated safe `redirectTo` handling and authenticated redirect behavior.
- Added action assertions to ensure login route calls the anonymous guard with `/app` override.

## Files To Read First

- `app/lib/auth.server.ts` - anonymous/authenticated route guard behavior
- `app/routes/login.tsx` - login loader/action guard wiring
- `app/routes/login.test.ts` - loader and action coverage for redirect behavior

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — passed (300 tests)
- `npm run typecheck` — passed

## Open Items

- Optional manual verification: while authenticated, visit `/login` directly and confirm immediate redirect to `/app`.

## Next Step

Commit branch changes, push, and open PR with `Closes #130`.
