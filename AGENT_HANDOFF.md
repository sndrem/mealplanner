# Agent Handoff

## Current Objective

Issue #272 on `issue/272-mark-basisvare-from-card`: let a family admin mark a shopping item as a basisvare while going through the list.

## Completed

- Admins can confirm **Merk som basisvare** on a generated recipe line from the week list and the family shopping list.
- The same action is on family shopping-list items. Confirming one saves a basisvare by display name and removes that family row.
- In store mode the action sits inside the info panel, not on the card face.
- The server saves one `FamilyStockIngredient` by canonical id when every generated member shares one, otherwise by display name. An existing basisvare is success. **Fjern fra handlelisten** is unchanged.
- The line leaves the list immediately. Generated matches can still be opted in for the week. Non-admins, manual items, and the read-only share card do not get the action.

## Files To Read First

- `app/lib/shopping-write.server.ts` — `markGeneratedShoppingItemsAsStock` and `markFamilyShoppingItemAsStock`
- `app/components/mark-generated-item-as-stock-form.tsx` — confirm step
- `app/components/store-mode-shopping-item-card.tsx` — info-panel placement
- `app/routes/family-meal-plan-store-mode.tsx` — store-mode actions and optimistic removal

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 717 tests passed
- `npm run typecheck` — passed
- Browser: the store-mode cards were inspected against the running list. The info-panel placement was not clicked through in a logged-in session after the last move.

## Open Items

- Manual check: mark a generated item and a family item (Egg, Melk) from store mode info, confirm each leaves the list and appears under basisvarer, opt a generated match in for this week, then open another plan and confirm it stays off until opted in.

## Next Step

Merge the PR for issue #272 after the manual store-mode check.
