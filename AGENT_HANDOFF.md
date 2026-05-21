# Agent Handoff

## Current Objective

Hotfix: GitHub Actions Fly deploy uses `flyctl` (not `fly`) on CI runners.

## Completed

- Fixed [`.github/workflows/fly-deploy.yml`](.github/workflows/fly-deploy.yml) deploy step: `flyctl deploy --remote-only`.
- Updated [`docs/deploy-fly.md`](docs/deploy-fly.md) CI section to reference `flyctl`.

## Files To Read First

- `.github/workflows/fly-deploy.yml` — deploy pipeline.

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 157 tests passed (31 files)
- `npm run typecheck` — passed

## Open Items

- Merge `bugfix` to `main` and re-run **Deploy to Fly.io** workflow.

## Next Step

Merge PR; confirm deploy job completes on `main`.
