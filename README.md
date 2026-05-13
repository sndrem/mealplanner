# Mealplanner

Mealplanner is a React Router 7 app that currently contains a validated planning prototype and the first production backend foundation for PostgreSQL + Prisma.

## Requirements

- Node.js `20.19+` (React Router 7 and Vite 8 require Node 20+)
- Docker Desktop or another Docker-compatible runtime
- npm

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
cp .env.example .env
```

3. Start the local PostgreSQL service:

```bash
docker compose up -d
```

4. Create or apply the database schema:

```bash
npm run prisma:migrate:dev -- --name init
```

For applying existing migrations to another database without creating a new one:

```bash
npm run prisma:migrate:deploy
```

5. Seed the development database with starter categories, stores, and recipes:

```bash
npm run prisma:seed
```

6. Validate the Prisma setup and generate the client:

```bash
npm run prisma:validate
npm run prisma:generate
```

7. Run the same baseline validation checks used in pull requests:

```bash
npm run lint
npm run test -- --run
npm run typecheck
npm run build
```

8. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Database Foundation

- Local PostgreSQL is defined in `docker-compose.yml`
- Prisma is configured in `prisma/schema.prisma`
- Baseline SQL migrations live in `prisma/migrations/`
- `DATABASE_URL` is validated at server startup in `app/lib/env.server.ts`
- The shared Prisma client lives in `app/lib/db.server.ts`

The current foundation now includes the initial production schema and a baseline Prisma migration for the core meal-planning domain.
The Prisma seed script populates reusable global starter data for ingredient categories, store section defaults, and recipes derived from the validated prototype.

## Environment Variables

Two environment variables are required right now:

```bash
DATABASE_URL="postgresql://mealplanner:mealplanner@localhost:5466/mealplanner?schema=public"
SESSION_SECRET="replace-this-with-a-long-random-string-of-at-least-32-characters"
```

`SESSION_SECRET` should be a long random string used to sign the login session cookie.

If either environment variable is missing or invalid, the server fails fast during startup instead of waiting until the first database access.

## Authentication

- Users can now register with name, e-post, and password
- Users can log in and out with a signed cookie session
- Protected routes redirect unauthenticated requests to `/login`
- The first protected route lives at `/app` and acts as the current family onboarding and landing state
- Authenticated users can create a family or join one with a family code from that protected flow

## Useful Commands

```bash
npm run dev
npm run lint
npm run test -- --run
npm run build
npm run typecheck
npm run prisma:migrate:dev -- --name <migration_name>
npm run prisma:migrate:deploy
npm run prisma:migrate:status
npm run prisma:seed
npm run prisma:validate
npm run prisma:generate
docker compose up -d
docker compose down
```

## Pull Request Validation

Pull requests now run [`.github/workflows/pr-validation.yml`](.github/workflows/pr-validation.yml) automatically when they are opened, updated, or reopened.

The workflow uses Node.js `20.19.0` and runs the same baseline validation commands used locally:

```bash
npm ci
npm run prisma:generate
npm run lint
npm run test -- --run
npm run typecheck
npm run build
```

CI sets placeholder values for `DATABASE_URL` and `SESSION_SECRET` so server-side environment validation can complete without requiring a live database connection.

## Backlog Issue Generation

Use the local `gh`-based backlog generator to preview or create GitHub issues from a reviewed issue spec.

Preview the generated issue bodies:

```bash
npm run backlog:issues -- --issues ideas/prototype-1-issues.json
```

Create the issues in GitHub after previewing them:

```bash
npm run backlog:issues -- --issues ideas/prototype-1-issues.json --create
```

Optional flags:

- `--brief <path>` overrides the markdown brief path.
- `--repo <owner/name>` overrides the target repository.
- `--output <path>` writes a JSON summary of the run.

Before using `--create`, make sure `gh` is installed and authenticated:

```bash
gh auth login
```

When creating issues, the script auto-creates any missing labels in the target repository before opening issues. Label colors are chosen deterministically so reruns stay predictable.

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

[Tailwind CSS](https://tailwindcss.com/) is already configured for the app and prototype UI.
