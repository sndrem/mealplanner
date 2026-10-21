# Agent Handoff

## Current Objective

Issue #314 is implemented on `issue/314-sink-finished-sections`, cut from `origin/main` (`c279d1e`). Local `main` had diverged, so this branch was not fast-forwarded from local `main`.

## Completed

- Store mode has a Visning chip, **Ferdige seksjoner nederst**, immediately after Skjul kjøpte varer. It starts off and is remembered per family in local storage.
- With the choice on and section headings shown, open sections stay in store order and finished sections follow in store order. A section is finished when this trip has nothing left to buy, including a section whose last item was removed while bought items stay visible.
- The same choice is mirrored in the non-httpOnly cookie `mealplanner-sink-finished-sections` so the first server render already sinks finished sections. Local storage stays the source of truth after hydration. Turning the choice off removes that family from the cookie.
- The three identical pressed chips share `StoreModePressedChip`. Boolean view preferences share one local-storage helper, and the section partition classifies “nothing left to buy” once.
- Hidden headings still use today's flat order. The shared list and the family shopping page are unchanged.

## Files To Read First

- `app/lib/shopping-store-mode-client.ts` — partition, local storage, and the cookie mirror
- `app/lib/use-store-mode-preferences.ts` — cookie initial state, then local storage
- `app/routes/family-meal-plan-store-mode.tsx` — loader reads the cookie

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 776 tests passed
- `npm run typecheck` — passed
- Logged-in store mode: with the chip on, finished section Annet moved below Tørrvarer. A fresh document request (cookie sent) rendered that same order. The chip was turned off again; the cookie is `{}` and Annet is back in store order. No new handlehistorikk events from this check.

## Open Items

- `GLOSSARY.md` is untracked and should stay out of this pull request.
- Earlier verification left a Wraps check and uncheck in handlehistorikk (21. okt., 09:50). The list also has later checks from 09:52 that this session did not make.
- A browser that already had the choice on in local storage, and no cookie yet, still shows store order on the first reload. The client then writes the cookie, so the reload after that matches.
- Hidden headings, fold off, and a second family were covered by tests, not in the browser.

## Next Step

Review and merge https://github.com/sndrem/mealplanner/pull/315. Issue #314 closes when that pull request merges.
