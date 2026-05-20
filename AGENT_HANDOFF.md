# Agent Handoff

## Current Objective

Issue #41 Fly.io deployment: production Docker image, `fly.toml`, and deploy documentation are implemented on branch `deploy-app`. Awaiting first `fly deploy` by operator.

## Completed

- Reworked [`Dockerfile`](Dockerfile) for Prisma generate, production prune, and Prisma CLI for release migrations.
- Added [`fly.toml`](fly.toml) for app `mealplanner` with `release_command` migrate deploy.
- Added [`docs/deploy-fly.md`](docs/deploy-fly.md) (secrets, deploy, rollback, smoke checks).
- Updated [`README.md`](README.md) env vars and deployment sections.
- Excluded `.env` from Docker context in [`.dockerignore`](.dockerignore).
- Removed debug log from [`app/lib/env.server.ts`](app/lib/env.server.ts).

## Files To Read First

- `docs/deploy-fly.md` — operator deploy workflow.
- `fly.toml` — Fly app config.
- `Dockerfile` — production image build.

## Validation

- `npm run test:run` — 161 tests passed.
- `docker build -t mealplanner .` — succeeded.

## Open Items

- Operator: set Fly secrets and run `fly deploy -a mealplanner`.
- Post-deploy smoke checklist in `docs/deploy-fly.md`.
- Separate follow-up: make Notion env vars optional.

## Next Step

Merge PR, deploy to Fly, run smoke checks on `https://mealplanner.fly.dev`.
