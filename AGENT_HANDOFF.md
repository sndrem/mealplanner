# Agent Handoff

## Current Objective

Issue #275 on `issue/275-quick-add-section`: quick-add should put a known ingredient in its category section instead of Annet.

## Completed

- Typed names that match the ingredient register save with that ingredient's category. Annet is only the fallback when neither the register nor a custom family-catalog category applies.
- A family catalog row stored as Annet no longer hides a register ingredient that has a real category. A custom catalog category still wins.
- Register matches skip creating another Annet catalog row. Enter and **Legg til** submit an exact suggestion id, and the optimistic row uses that category.

## Files To Read First

- `app/lib/shopping-write.server.ts` — `resolveQuickAddManualShoppingItemValues`
- `app/lib/shopping-catalog.server.ts` — suggestion merge when a catalog row is Annet
- `app/components/manual-shopping-quick-add.tsx` — exact-name submit
- `app/lib/shopping-list-client.ts` — `resolveQuickAddPlaceholderPlacement`

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 727 tests passed
- `npm run typecheck` — passed
- Browser: not checked. Confirming the section needs a logged-in shopping list.

## Open Items

- Manual check: type Melk and press Enter, confirm it lands in Meieri; type an unknown name and confirm Annet; type a custom family item and confirm its catalog category.
- Existing shopping lines already saved as Annet stay where they are. The next quick-add of that name uses the register category.

## Next Step

Review and merge the pull request for issue #275.
