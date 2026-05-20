# Deploy to Fly.io

This guide covers deploying the **mealplanner** app to [Fly.io](https://fly.io) with operator-managed PostgreSQL, Prisma migrations on release, and an empty production database (no seed).

## Prerequisites

- [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and authenticated (`fly auth login`)
- Access to the Fly org where the `mealplanner` app will run
- A production PostgreSQL `DATABASE_URL` reachable from Fly machines
- Required secrets ready to set on Fly (see below)

## Required environment variables

The server validates these at startup ([`app/lib/env.server.ts`](../app/lib/env.server.ts)):

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://` or `postgres://`) |
| `SESSION_SECRET` | Cookie session signing (min 32 characters) |
| `NOTION_API_TOKEN` | Required by validation today; use placeholders if import is unused |
| `NOTION_INGREDIENTS_DATABASE_ID` | Placeholder until Notion is removed in a follow-up task |
| `NOTION_RECIPES_DATABASE_ID` | Placeholder until Notion is removed in a follow-up task |

Set secrets on Fly (never commit production values):

```bash
fly secrets set \
  DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public" \
  SESSION_SECRET="<generate-a-long-random-string>" \
  NOTION_API_TOKEN="placeholder" \
  NOTION_INGREDIENTS_DATABASE_ID="placeholder" \
  NOTION_RECIPES_DATABASE_ID="placeholder" \
  -a mealplanner
```

Generate a strong `SESSION_SECRET`, for example:

```bash
openssl rand -base64 32
```

## One-time app setup

If the app does not exist yet:

```bash
fly apps create mealplanner
```

Or launch from the repo (uses [`fly.toml`](../fly.toml) and [`Dockerfile`](../Dockerfile)):

```bash
fly launch --no-deploy --copy-config
```

Adjust `primary_region` in `fly.toml` if needed (default: `ams`).

## Database

- Provision PostgreSQL yourself (managed provider, Fly Postgres, etc.) and set `DATABASE_URL` as a Fly secret.
- **First deploy** applies schema via `release_command` (`npx prisma migrate deploy`) against an **empty** database.
- **Do not** run `prisma:seed` in production unless you intentionally want starter data; populate the app manually (register, create family, etc.).

Check migration status on a running machine:

```bash
fly ssh console -a mealplanner -C "npx prisma migrate status"
```

## Deploy

From the repository root:

```bash
fly deploy -a mealplanner
```

Useful follow-up commands:

```bash
fly status -a mealplanner
fly logs -a mealplanner
fly open -a mealplanner
```

Each deploy runs migrations in a release machine before routing traffic to the new image.

## Rollback

List recent releases:

```bash
fly releases list -a mealplanner
```

Redeploy a previous image (replace `<image-ref>` from the releases list):

```bash
fly deploy --image <image-ref> -a mealplanner
```

See [Fly rollback docs](https://fly.io/docs/blueprint/rollback/) for machine-level options.

## Post-deploy smoke checks

Replace `<app>` with your Fly hostname (e.g. `mealplanner.fly.dev`).

| Check | Command | Expected |
| ----- | ------- | -------- |
| App boots | `fly logs -a mealplanner` | No `Invalid server environment configuration` |
| Migrations | `fly ssh console -a mealplanner -C "npx prisma migrate status"` | All migrations applied |
| Home | `curl -sfI https://<app>/` | HTTP `200` |
| Login | `curl -sfI https://<app>/login` | HTTP `200` |
| Protected redirect | `curl -sfI https://<app>/app` | HTTP `302` to `/login` when logged out |
| Register | `curl -sfI https://<app>/register` | HTTP `200` |

Manual browser check:

1. Open `https://<app>/register` and create an account.
2. Log in and complete the `/app` family onboarding flow.

## Local Docker validation (optional)

Build and run the production image locally before Fly deploy:

```bash
docker build -t mealplanner .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://mealplanner:mealplanner@host.docker.internal:5466/mealplanner?schema=public" \
  -e SESSION_SECRET="local-docker-secret-at-least-thirty-two-chars" \
  -e NOTION_API_TOKEN="placeholder" \
  -e NOTION_INGREDIENTS_DATABASE_ID="placeholder" \
  -e NOTION_RECIPES_DATABASE_ID="placeholder" \
  mealplanner
```

Ensure local Postgres is running (`docker compose up -d`) if using the example URL.

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------- |
| Deploy fails on release command | Wrong `DATABASE_URL`, DB unreachable from Fly, or SSL params missing |
| `Invalid server environment configuration` | Missing or invalid secret; check `fly secrets list` |
| App exits immediately | Prisma client/schema mismatch — rebuild image after schema changes |
| Slow first request | `min_machines_running = 0` stops idle machines; first hit cold-starts |
| Session cookie not set | `SESSION_SECRET` too short or not set on Fly |

## Related files

- [`fly.toml`](../fly.toml) — Fly app config and `release_command`
- [`Dockerfile`](../Dockerfile) — production image build
- [`prisma/migrations/`](../prisma/migrations/) — schema migrations applied on deploy
