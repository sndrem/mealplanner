# Agent Handoff

## Current Objective

`issue/324-upsert-recipe-cover` lets MCP `upsert_recipe` set or clear a family recipe cover. The branch was cut from current `origin/main` (`468ce44`) with `--no-track` because local `main` had diverged.

## Completed

- `upsert_recipe` accepts optional `imageUrl` (https, no userinfo) and `removeCoverImage: true` on update. Omitting both leaves the cover. Both together, or remove on create, is rejected.
- The server downloads the image before creating or updating the recipe, rejects private and link-local addresses, follows at most 3 redirects, and accepts only JPEG, PNG, or WebP up to 2 MB when the content type matches the file bytes.
- The bytes are passed into the existing cover upload as a `File`. A failed download does not create or change the recipe.
- `docs/mcp.md` and the tool description no longer say covers are web-only.

## Files To Read First

- `app/lib/fetch-recipe-cover.server.ts` — HTTPS download and address checks
- `app/lib/mcp-tools.server.ts` — `resolveUpsertCover` wires the file into create/update
- `app/lib/mcp-recipe-schema.ts` — `imageUrl` and `removeCoverImage`
- `docs/mcp.md` — caller-facing cover rules

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 845 tests passed
- `npm run typecheck` — passed
- MCP Inspector against a live recipe was not run

## Open Items

- DNS rebinding between lookup and connect is accepted for this issue.
- Confirm with MCP Inspector: create with a public JPEG URL, update omitting the image, then `removeCoverImage`, and check the recipe page.
- `temp-delete-later/` is untracked and stays out of the commit.

## Next Step

Review and merge the pull request for #324.
