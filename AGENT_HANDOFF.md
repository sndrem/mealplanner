# Agent Handoff

## Current Objective

Add `get_active_shopping_list` so the newspaper agent reads the Handleliste trip instead of the full family shopping projection. Branch `get-active-shopping-list` is cut from current `origin/main` after #300 merged.

## Completed

- The new read tool returns unchecked items still due for the MCP user's saved trip focus (this week, next week, or all open plans).
- Bought rows, past days, and postponed items stay out of that payload.
- `get_shopping_list` still returns the full projection. Its description points agents at `get_active_shopping_list` for flyer matching.
- `docs/mcp.md` documents both tools.

## Files To Read First

- `app/lib/mcp-tools.server.ts` — `getActiveShoppingListForMcp`
- `app/lib/mcp-handler.server.ts` — the tool description
- `docs/mcp.md` — what to tell the agent

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 743 tests passed
- `npm run typecheck` — passed
- Handleliste was not clicked through. This change is an MCP read tool.

## Open Items

- Refresh the agent's MCP tool list after deploy, or it will keep calling `get_shopping_list`.
- Untracked `temp-delete-later/` drafts are not part of this change.

## Next Step

Review the pull request, then confirm a flyer run uses `get_active_shopping_list` and returns the short trip.
