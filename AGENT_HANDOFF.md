# Agent Handoff

## Current Objective

Ship family-scoped MCP on the existing Fly web process ([#241](https://github.com/sndrem/mealplanner/issues/241) / [PR #242](https://github.com/sndrem/mealplanner/pull/242)), including HTTPS MCP address for Inspector.

## Completed

- Read-only Streamable HTTP MCP at `/mcp` on the existing React Router process
- Family hashed bearer token with admin create/rotate/revoke on the Familie tab
- Public MCP URL is rewritten to `https` (localhost stays `http`) so Inspector can connect
- Docs in `docs/mcp.md`

## Files To Read First

- `app/lib/mcp-token.server.ts` — token CRUD, Bearer auth, and MCP URL builder
- `app/lib/mcp-handler.server.ts` — MCP v2 handler and tool registration
- `app/routes/mcp.ts` — public `/mcp` resource route
- `app/components/family-mcp-token-card.tsx` — admin mint UI

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 615 tests passed
- `npm run typecheck` — passed
- Browser Familie-tab mint flow — not re-run after HTTPS rewrite
- MCP Inspector against production HTTPS URL — not run (needs deploy)

## Open Items

- Production migration runs via Fly `release_command`
- After merge: copy the HTTPS MCP address, mint a key, connect Inspector
- Follow-ups: suggestion persist/view and periodic agent

## Next Step

Merge [PR #242](https://github.com/sndrem/mealplanner/pull/242).
