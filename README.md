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

4. Validate the Prisma setup and generate the client:

```bash
npm run prisma:validate
npm run prisma:generate
```

5. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Database Foundation

- Local PostgreSQL is defined in `docker-compose.yml`
- Prisma is configured in `prisma/schema.prisma`
- `DATABASE_URL` is validated at server startup in `app/lib/env.server.ts`
- The shared Prisma client lives in `app/lib/db.server.ts`

The current foundation intentionally stops before defining application models. Schema design and migrations belong to the next issue.

## Environment Variables

Only one environment variable is required right now:

```bash
DATABASE_URL="postgresql://mealplanner:mealplanner@localhost:5466/mealplanner?schema=public"
```

If `DATABASE_URL` is missing or invalid, the server fails fast during startup instead of waiting until the first database access.

## Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run prisma:validate
npm run prisma:generate
docker compose up -d
docker compose down
```

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
