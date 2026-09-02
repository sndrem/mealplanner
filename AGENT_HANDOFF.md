# Agent Handoff

## Current Objective

Ship MCP meal-plan proposals ([#243](https://github.com/sndrem/mealplanner/issues/243)): write tool, `PROPOSED` persistence, and email-linked review UI.

## Completed

- Cut `issue/243-mcp-meal-plan-proposal` from current `origin/main` after `git pull --ff-only`
- Added `MealPlanStatus.PROPOSED` plus migration `20260902093000_add_meal_plan_proposed_status`
- Live surfaces (covering date, ukeplaner list, home week, calendar sub, store mode, shopping ranges) ignore `PROPOSED`
- `create_meal_plan_proposal` MCP tool upserts next-week (or given Mon–Sun) dinners and returns `proposalUrl`
- Authenticated `/families/:familyId/meal-plans/:mealPlanId/proposal` for adjust + Godkjenn (`PROPOSED` → `APPROVED`)
- Docs (`docs/mcp.md`) and Familie MCP card copy updated
- Local validation passed; ready to open PR

## Files To Read First

- `app/lib/meal-plan.server.ts` — `createOrReplaceMealPlanProposal`, `approveMealPlanProposal`
- `app/lib/mcp-tools.server.ts` / `app/lib/mcp-handler.server.ts` — write tool
- `app/routes/family-meal-plan-proposal.tsx` — review UI
- `app/lib/meal-plan-status.server.ts` — live-plan status filter

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 628 tests passed
- `npm run typecheck` — passed
- Browser proposal/approve flow — not run
- MCP Inspector against `/mcp` — not run
- Prisma migrate against local DB — not run (`prisma:generate` only)

## Open Items

- Production migration runs via Fly `release_command` (`prisma migrate deploy`)
- After merge: mint a key, call `create_meal_plan_proposal`, open `proposalUrl`, tweak a dinner, approve
- Confirm proposals stay off shopping/calendar/`list_meal_plans` until approved

## Next Step

Merge the PR for #243 after review.
