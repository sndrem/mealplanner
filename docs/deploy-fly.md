# Deploy to Fly.io

This guide covers deploying the **mealplanner** app to [Fly.io](https://fly.io) with operator-managed PostgreSQL, Prisma migrations on release, and an empty production database (no seed).

## Prerequisites

- [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and authenticated (`fly auth login`)
- Access to the Fly org where the `mealplanner-xzvzow` app will run
- A production PostgreSQL `DATABASE_URL` reachable from Fly machines
- Required secrets ready to set on Fly (see below)

## Required environment variables

The server validates these at startup ([`app/lib/env.server.ts`](../app/lib/env.server.ts)):

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://` or `postgres://`) |
| `SESSION_SECRET` | Cookie session signing (min 32 characters) |

Optional (password reset mail). The app starts without them; forgot-password emails only reach inboxes when SMTP host, user, and password are set. A Gmail address works without a custom domain (use an [App Password](https://myaccount.google.com/apppasswords)):

| Variable | Purpose |
| -------- | ------- |
| `SMTP_HOST` | SMTP server, e.g. `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port (defaults to `587`; use `465` for implicit TLS) |
| `SMTP_USER` | SMTP username (the Gmail address) |
| `SMTP_PASS` | SMTP password (Gmail app password) |
| `EMAIL_FROM` | From header, e.g. `Mealplanner <you@gmail.com>` (defaults to `SMTP_USER`) |

Optional (Thursday weekend-plan reminders). The app starts without this; the job route returns 503 until it is set. Use the **same** value as the GitHub Actions `CRON_SECRET` secret:

| Variable | Purpose |
| -------- | ------- |
| `CRON_SECRET` | Bearer token for `POST /internal/jobs/weekend-plan-reminders` |

Optional (recipe cover images via Cloudflare R2). The app starts without them; image upload is disabled until all R2 variables are set:

| Variable | Purpose |
| -------- | ------- |
| `R2_ACCOUNT_ID` | Cloudflare account ID (S3 endpoint host) |
| `R2_ACCESS_KEY_ID` | R2 API token access key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret access key |
| `R2_BUCKET_NAME` | Bucket name, e.g. `mealplanner-recipe-images` |
| `R2_PUBLIC_BASE_URL` | Public HTTPS base for objects (custom domain or `*.r2.dev`), no trailing slash |

### Cloudflare R2 setup (one-time)

1. In the [Cloudflare dashboard](https://dash.cloudflare.com), open **Storage & databases → R2** and create a bucket (e.g. `mealplanner-recipe-images`).
2. Enable public read access:
   - **Dev / staging:** bucket **Settings → Public Development URL** → Enable, then copy the `*.r2.dev` base URL.
   - **Production:** bucket **Settings → Custom Domains** → connect e.g. `images.yourdomain.com` (domain must be on Cloudflare).
3. **Manage R2 API Tokens → Create API token** with **Object Read & Write** scoped to that bucket. Copy Access Key ID and Secret Access Key (secret is shown once). Endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
4. Set the five `R2_*` variables locally in `.env` and on Fly (below).

Set secrets on Fly (never commit production values):

```bash
fly secrets set \
  DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public" \
  SESSION_SECRET="<generate-a-long-random-string>" \
  SMTP_HOST="smtp.gmail.com" \
  SMTP_PORT="587" \
  SMTP_USER="you@gmail.com" \
  SMTP_PASS="<gmail-app-password>" \
  EMAIL_FROM="Mealplanner <you@gmail.com>" \
  CRON_SECRET="<generate-a-long-random-string>" \
  R2_ACCOUNT_ID="<cloudflare-account-id>" \
  R2_ACCESS_KEY_ID="<access-key-id>" \
  R2_SECRET_ACCESS_KEY="<secret-access-key>" \
  R2_BUCKET_NAME="mealplanner-recipe-images" \
  R2_PUBLIC_BASE_URL="https://images.yourdomain.com" \
  -a mealplanner-xzvzow
```

Generate a strong `SESSION_SECRET`, for example:

```bash
openssl rand -base64 32
```

## One-time app setup

If the app does not exist yet:

```bash
fly apps create mealplanner-xzvzow
```

Or launch from the repo (uses [`fly.toml`](../fly.toml) and [`Dockerfile`](../Dockerfile)):

```bash
fly launch --no-deploy --copy-config
```

Adjust `primary_region` in `fly.toml` if needed (default: `ams`).

## Database

- Provision PostgreSQL yourself (managed provider, Fly Postgres, etc.) and set `DATABASE_URL` as a Fly secret.
- **First deploy** applies schema via `release_command` (`npx prisma migrate deploy`) against an **empty** database.
- **Do not** run full `prisma:seed` in production unless you intentionally want starter data; populate the app manually (register, create family, etc.).
- The ingredient catalog in `prisma/data/catalog-ingredient-seeds.csv` is upserted idempotently by `prisma:seed` (safe to run once) if you want manual-shopping typeahead for common items in production.

Check migration status on a running machine:

```bash
fly ssh console -a mealplanner-xzvzow -C "npx prisma migrate status"
```

## Deploy

### Automated (recommended)

Merges to `main` deploy automatically via GitHub Actions after validation. See [Continuous deployment (GitHub Actions)](#continuous-deployment-github-actions).

### Manual (fallback)

From the repository root:

```bash
fly deploy -a mealplanner-xzvzow
```

Useful follow-up commands:

```bash
fly status -a mealplanner-xzvzow
fly logs -a mealplanner-xzvzow
fly open -a mealplanner-xzvzow
```

Each deploy runs migrations in a release machine before routing traffic to the new image.

## Continuous deployment (GitHub Actions)

Routine production releases use [`.github/workflows/fly-deploy.yml`](../.github/workflows/fly-deploy.yml) (issue #42). The manual `fly deploy` flow from issue #41 remains available as a fallback.

### Triggers

| Trigger | When it runs |
| ------- | ------------- |
| Push to `main` | Automatically after validation passes |
| `workflow_run` (`Auto-merge PR` completed) | After auto-merge squash-merges a PR — needed because GITHUB_TOKEN merges do not fire `push` |
| `workflow_dispatch` | Manually from **Actions → Deploy to Fly.io → Run workflow** (must run on the `main` branch) |

Pull request branches do not trigger this workflow. The same GITHUB_TOKEN merge path also skips GitHub's `Closes #N` handling; [`.github/workflows/auto-merge.yml`](../.github/workflows/auto-merge.yml) closes linked issues after a successful squash merge.

### GitHub secret (one-time setup)

Create a deploy token and add it as a **repository** secret (Settings → Secrets and variables → Actions), not only an environment secret:

```bash
fly tokens create deploy -a mealplanner-xzvzow
```

Add the token value as `FLY_API_TOKEN`.

For Thursday weekend-plan reminders, also add repository secrets `CRON_SECRET` (same value as the Fly `CRON_SECRET` secret) and `MEALPLANNER_APP_URL`. Paste the origin only, with no quotes, path, or trailing slash, e.g. `https://mealplanner-xzvzow.fly.dev`. The scheduled workflow [`.github/workflows/weekend-plan-reminders.yml`](../.github/workflows/weekend-plan-reminders.yml) POSTs to `/internal/jobs/weekend-plan-reminders`. Manual **Run workflow** can pass `force` to bypass the Thursday 12:00 Europe/Oslo window.

Runtime secrets (`DATABASE_URL`, `SESSION_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `CRON_SECRET`, etc.) stay on Fly via `fly secrets set`. `CRON_SECRET` is the exception that is **also** stored in GitHub so the reminder workflow can authenticate.

### Pre-deploy checks

The workflow `validate` job mirrors PR CI before deploy:

```bash
npm ci
npm run prisma:generate
npm run lint
npm run test:run
npm run typecheck
npm run build
```

### What deploy does

1. Builds the production image on Fly remote builders (`flyctl deploy --remote-only`).
2. Runs `release_command` from [`fly.toml`](../fly.toml) (`npx prisma migrate deploy`).
3. Routes traffic to the new release when the release machine succeeds.

### Failure handling

| Failure | What to check |
| ------- | ------------- |
| `validate` job fails | Fix lint, tests, typecheck, or build locally; merge a fix to `main` |
| Auth error on deploy | `FLY_API_TOKEN` missing, expired, or stored in the wrong secret scope |
| Deploy / build fails | GitHub Actions logs for the run; `fly logs -a mealplanner-xzvzow` |
| `release_command` fails | Database URL, connectivity, or pending migrations; previous release keeps serving traffic |

After fixing the root cause, push to `main` or re-run the workflow via `workflow_dispatch`.

### Rollback after an automated deploy

Automated deploys use the same rollback steps as manual deploys (see below). Redeploying an older image does **not** undo database migrations already applied by a failed or bad release; treat schema rollback as a separate, careful operation.

## Rollback

List recent releases:

```bash
fly releases list -a mealplanner-xzvzow
```

Redeploy a previous image (replace `<image-ref>` from the releases list):

```bash
fly deploy --image <image-ref> -a mealplanner-xzvzow
```

See [Fly rollback docs](https://fly.io/docs/blueprint/rollback/) for machine-level options.

## Post-deploy smoke checks

Replace `<app>` with your Fly hostname (e.g. `mealplanner-xzvzow.fly.dev`).

| Check | Command | Expected |
| ----- | ------- | -------- |
| App boots | `fly logs -a mealplanner-xzvzow` | No `Invalid server environment configuration` |
| Migrations | `fly ssh console -a mealplanner-xzvzow -C "npx prisma migrate status"` | All migrations applied |
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
  mealplanner
```

Ensure local Postgres is running (`docker compose up -d`) if using the example URL.

## Remove legacy Notion secrets

If the app was deployed before Notion import was removed, unset obsolete secrets:

```bash
fly secrets unset NOTION_API_TOKEN NOTION_INGREDIENTS_DATABASE_ID NOTION_RECIPES_DATABASE_ID -a mealplanner-xzvzow
```

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------- |
| Deploy fails on release command | Wrong `DATABASE_URL`, DB unreachable from Fly, or SSL params missing |
| `Invalid server environment configuration` | Missing or invalid secret; check `fly secrets list` |
| App exits immediately | Prisma client/schema mismatch — rebuild image after schema changes |
| Slow first request | `min_machines_running = 0` stops idle machines; first hit cold-starts |
| Session cookie not set | `SESSION_SECRET` too short or not set on Fly |

## Related files

- [`.github/workflows/fly-deploy.yml`](../.github/workflows/fly-deploy.yml) — CI validation and Fly deploy on `main`
- [`fly.toml`](../fly.toml) — Fly app config and `release_command`
- [`Dockerfile`](../Dockerfile) — production image build
- [`prisma/migrations/`](../prisma/migrations/) — schema migrations applied on deploy
