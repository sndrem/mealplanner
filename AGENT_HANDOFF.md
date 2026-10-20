# Agent Handoff

## Current Objective

Ship readable store-mode item details on a narrow phone. Branch `issue/306-store-mode-card-width` was cut from current `origin/main`.

## Completed

- Opening the info panel stacks the source line, Endre seksjon, Notat, Hurtiglegg til, and Merk som basisvare under the icon and name at full card width.
- Closed cards stay a compact row: icon, name, quantity, and the info button under the name.
- Store mode and the guest share list use one grid: one column below 480px, two from 480px, three at `sm`, four at `lg`. List view stays a single column.
- The section select and note input use `text-base` so iOS does not zoom on focus.

## Files To Read First

- `app/components/store-mode-shopping-item-card.tsx` — card grid and open details span
- `app/lib/store-mode-theme.ts` — `storeModeItemGridClass`
- `app/routes/family-meal-plan-store-mode.tsx` — grid vs list
- `app/routes/shopping-list-share.tsx` — guest grid uses the same class

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 757 tests passed
- `npm run typecheck` — passed
- Browser on store mode: at 390px and 320px, two items in Annet stack, and an open Melk panel uses the card width with normal wrapping and no page overflow. At 480px the grid is two columns, at 640px three, at 1024px four. List view stays one column with a full-width open panel. The quantity editor still opens. The guest share page was not opened.

## Open Items

- At `sm`, three columns are about 180–200px. Merk som basisvare can wrap inside its pill.
- Untracked `temp-delete-later/` drafts are not part of this change.

## Next Step

Review the pull request for issue #306, then merge.
