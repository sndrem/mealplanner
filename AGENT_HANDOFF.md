# Agent Handoff

## Current Objective

Sink finished store-mode sections below open ones for issue #314. Branch `issue/314-sink-finished-sections` was cut from current `origin/main` (`c279d1e`). Local `main` had diverged (ahead 1, behind 1), so this branch was not fast-forwarded from local `main`.

## Completed

- Store mode has a Visning chip, **Ferdige seksjoner nederst**, immediately after Skjul kjøpte varer. It starts off and is remembered per family in local storage.
- With the choice on and section headings shown, open sections stay in store order and finished sections follow in store order. A section is finished only when this trip has nothing left to buy.
- Hidden headings still use today's flat order. The shared list and the family shopping page are unchanged.
- Checked Wraps in the live store-mode trip to confirm the section sank, then undid it. The item is unchecked again. That check and undo are in the family's handlehistorikk.

## Files To Read First

- `app/lib/shopping-store-mode-client.ts` — partition flag and the remembered boolean
- `app/lib/use-store-mode-shopping-view.ts` — applies the flag only while headings are shown
- `app/components/store-mode-trip-panel.tsx` — chip placement in Visning

## Validation

- `npx vitest run app/lib/shopping-store-mode-client.test.ts` — 52 tests passed
- `npx eslint` on the touched store-mode files — passed
- `npm run typecheck` — passed
- `npm run test:run` — 773 tests passed
- Logged-in store mode: chip sits after Skjul kjøpte varer, starts off, shows pressed when on, survives reload, and sinks Bakst og brød after its last item is checked. Undo puts that section back. The choice was turned off again afterward.

## Open Items

- The live trip's handlehistorikk now includes a Wraps check and uncheck from that verification.
- Hidden headings, fold off, and a second family were covered by the client tests, not in the browser.

## Next Step

Review and open a pull request for issue #314.
