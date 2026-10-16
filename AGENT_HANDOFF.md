# Agent Handoff

## Current Objective

Ship line icons on shopping rows. Branch `issue/304-shopping-item-icons` was cut from current `origin/main`.

## Completed

- Store mode, the family shopping list, and the public share each show a decorative mint chip left of the item name.
- Known names in `namesByIcon` use a line drawing (milk carton, whole chicken, cheese wheel, one strawberry, and the rest).
- Any other name uses a thick letter from the first letter of the item, including Æ, Ø, and Å.
- Icons are resolved on the client from the normalized name. `category.key` is optional on projected items and share snapshots so older snapshots still parse.
- Checked rows keep the icon and fade it.

## Files To Read First

- `app/lib/shopping-item-icons.ts` — name-to-drawing map and letter fallback
- `app/components/shopping-item-icon.tsx` — chip and SVG drawings
- `app/components/store-mode-shopping-item-card.tsx` — icon on the store-mode row
- `app/routes/family-shopping.tsx` — icon on the family list

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 757 tests passed
- `npm run typecheck` — passed
- Static render of `ShoppingItemIcon`: drawings for milk, tomato, chicken, cheese, strawberry, and bread; letters for Tacolefser, Grillmat, Potetgull, Cola, Salt, Tunfisk, Ørret, Æ, and Å; faded checked milk; dark chip. Logged-in store mode and the family list were not clicked through.

## Open Items

- Flour, sugar, oats, and cereal still share the rice-bowl drawing because those names are listed under `rice`.
- Untracked `temp-delete-later/` drafts are not part of this change.

## Next Step

Review the pull request for issue #304, then merge.
