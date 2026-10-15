# Agent Handoff

## Current Objective

Ship [#298](https://github.com/sndrem/mealplanner/issues/298) on `issue/298-store-offer-briefing`: a weekly store-offer banner on Handleliste, published by the family MCP server as title, subtitle, and plain text. The branch was cut from current `origin/main`.

## Completed

- `publish_store_offer_briefing` and `get_store_offer_briefing` store one briefing per family per Europe/Oslo week. Omitting the week targets next Monday–Sunday. Republish replaces the three texts.
- Handleliste shows `Ukens tilbud` under the scan bar: title, subtitle, and a `Ny` chip. Expanding shows the plain-text findings. Skjul leaves `Vis ukens tilbud`. A new `updatedAt` shows `Ny` again.
- A next-week briefing stays loud on the default `Denne uken` focus through `weekEnd`. After that, an overlapping focused week becomes the quiet line `Tilbudene for denne uken er ute`.
- The share list does not load the briefing. Local migration `20261015140000_add_store_offer_briefing` is applied on the local database.

## Files To Read First

- `app/lib/store-offer-briefing.ts` — text limits, week check, loud/quiet/hidden selection
- `app/lib/store-offer-briefing.server.ts` — upsert and the store-mode query
- `app/components/store-offer-briefing-banner.tsx` — the banner
- `app/lib/mcp-handler.server.ts` — the tool descriptions the agent sees
- `docs/mcp.md` — the format to give the newspaper agent

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 741 tests passed
- `npm run typecheck` — passed
- `npm run prisma:migrate:deploy` — applied `20261015140000_add_store_offer_briefing` earlier in this branch
- Opened `http://localhost:5176/`. The homepage is logged out, so Handleliste was not clicked through.

## Open Items

- Confirm while logged in, at phone width: publish the sample brief, see the banner with Handletur collapsed, expand it, hide it, republish, and confirm `Ny` returns. Confirm the share link has no banner.
- Untracked `temp-delete-later/` drafts are not part of this change.
- The long-running dev server on port 5176 was started before this branch. Restart it if Handleliste errors on the new Prisma model.

## Next Step

Review the pull request for #298, then check the banner on a logged-in Handleliste.
