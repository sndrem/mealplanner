# Agent Handoff

## Current Objective

Ship MCP family recipe upsert for [#246](https://github.com/sndrem/mealplanner/issues/246) on `issue/246-mcp-upsert-recipe`.

## Completed

- `upsert_recipe` MCP tool creates or partially updates family recipes with Zod validation
- `list_ingredient_categories` plus richer `get_recipe` (category key/id, store, reminders)
- `createFamilyRecipe` persists reminder suggestions
- Docs in `docs/mcp.md`

## Files To Read First

- `app/lib/mcp-recipe-schema.ts` — Zod input contract
- `app/lib/mcp-tools.server.ts` — resolve, merge, upsert
- `app/lib/mcp-handler.server.ts` — tool registration

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 649 tests passed
- `npm run typecheck` — passed
- MCP Inspector / live `/mcp` — not run

## Open Items

- After merge: smoke-test `upsert_recipe` against local or production `/mcp`
- Cover images remain web-only

## Next Step

Merge the PR for #246 after CI.
