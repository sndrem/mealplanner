# Agent Handoff

## Current Objective

Enkel visning is on branch `enkel-visning-ship`, cut from current `origin/main`. It is the Flis layout: a phone preference that strips store mode down to section headings and item tiles.

## Completed

- **Tilpass → Visning → Enkel visning** is stored per family in localStorage, off until turned on. The summary (progress, checked count, store, trip focus) hides. Tilpass stays.
- Sections are a heading on a line. Items are tiles: name on top, quantity bottom left, check bottom right. **Rutenett** is two columns at every width. **Liste** is one column. The ordinary grid breakpoints are unchanged.
- The basisvarer reminder is hidden. **Merk som basisvare**, notes, and recipes stay behind the info control on the tile. **Farge etter bruk** keeps the edge and drops the «i dag» / «i morgen» words.
- Quick-add, undo, celebration, banners, history, and the **Handlet** fold stay.
- **Skjul kategorier** stays on the choice after it saves. Store mode does not reload the trip for that save, so the screen was falling back to the old headings. The saved choice is now kept from the action result.
- **Basisvare** is in `GLOSSARY.md`.

## Files To Read First

- `app/components/store-mode-shopping-item-card.tsx` — Flis tile face
- `app/components/store-mode-due-list.tsx` — heading, hidden basisvarer reminder
- `app/components/store-mode-scan-bar.tsx` — summary hidden, Tilpass kept
- `app/lib/store-mode-route-state.ts` — keeps the saved category-heading choice
- `app/lib/use-store-mode-preferences.ts` — `simpleView` preference

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 812 tests passed
- `npm run typecheck` — passed
- Signed-in store mode was not exercised. The editor browser at `http://127.0.0.1:5174/` is logged out.

## Open Items

- No GitHub issue matches this work. The open issues are #287 and #43.
- Confirm Enkel visning on a phone in the signed-in trip, then turn it off. Do not check real items; that writes handlehistorikk.
- `temp-delete-later/enkel-visning-proposals/` is disposable and stays uncommitted.

## Next Step

Review the pull request for `enkel-visning-ship`.
