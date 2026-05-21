---
name: fallow-code-health
description: Audits the mealplanner codebase with Fallow for dead code, unused dependencies, duplication, complexity, and architecture issues. Use when the user asks for code health analysis, cleanup, dead code removal, unused exports, duplicate code, complexity hotspots, or to run fallow on this project.
---

# Fallow code health (mealplanner)

## Goal

Run [Fallow](https://docs.fallow.tools) static analysis on this repo, interpret results with mealplanner-specific context, and propose safe cleanup — without breaking React Router routes, Prisma, or server-only modules.

## Prerequisites

1. **Read the global Fallow skill** at `~/.cursor/skills/fallow-skills/fallow/skills/fallow/SKILL.md` for CLI rules, JSON flags, issue types, `fix` workflow, and MCP tools. Follow its agent rules (especially `--format json --quiet 2>/dev/null`, `|| true`, never `fallow watch`).
2. **Fallow is a devDependency** — use `npm run analyze:*` or `npx fallow` from the repo root.

3. **No project config yet** — Fallow auto-detects React Router, Vite, Vitest, and Prisma. Only add `.fallowrc.json` after reviewing false positives; do not add remote `extends` URLs.

## What Fallow covers here (and what it does not)

| Use Fallow for | Use something else for |
|----------------|------------------------|
| Unused files, exports, types, deps | ESLint style (`npm run lint`) |
| Duplicate code | Type errors (`npm run typecheck`) |
| Complexity hotspots | Runtime bugs / test failures (`npm run test:run`) |
| Circular / boundary issues | Security scanning |

Fallow complements CI (`lint`, `test:run`, `typecheck`, `build`); it does not replace them.

## Project map (interpretation hints)

| Path | Role | Common Fallow notes |
|------|------|---------------------|
| `app/routes.ts` | Route manifest (entry) | Exports here are consumed by the framework |
| `app/routes/**` | Pages, loaders, actions | Route modules are entry points |
| `app/lib/**.server.ts` | Server-only logic | Imported from routes/actions; `.server` suffix is intentional |
| `app/components/**` | UI | May look unused until wired into a route |
| `app/features/**` | Feature modules | Same as components |
| `app/test/**`, `**/*.test.ts(x)` | Vitest | Use `--production` only when auditing prod-only dead code |
| `prisma/**`, `prisma.config.ts` | DB schema & seed | Seed scripts may reference deps only at runtime |
| `prototype/**` | Legacy spike | Often entirely unreachable — confirm with user before deleting |
| `entry.server.tsx`, `app/root.tsx` | App shell | Entry points |

Stack: React Router 7, Vite, Vitest, Prisma, Tailwind 4, single package (not a monorepo).

## Audit workflow

Copy and track progress:

```
- [ ] Step 1: Confirm Fallow available
- [ ] Step 2: Baseline dead code
- [ ] Step 3: Duplication (if requested or many large files)
- [ ] Step 4: Complexity (if requested or refactor prep)
- [ ] Step 5: Summarize with priorities
- [ ] Step 6: Fix only with explicit user approval
```

### Step 1: Confirm Fallow

```bash
npx fallow --version 2>/dev/null
npx fallow list --entry-points --format json --quiet 2>/dev/null || true
npx fallow list --plugins --format json --quiet 2>/dev/null || true
```

Or use the npm scripts: `analyze:dead-code`, `analyze:dupes`, `analyze:health`.

Verify React Router / Vite / Vitest plugins are detected.

### Step 2: Dead code baseline

Full audit (default starting point):

```bash
npm run analyze:dead-code -- --explain 2>/dev/null || true
# equivalent: npx fallow dead-code --format json --quiet --explain 2>/dev/null || true
```

Targeted passes when the user names a concern:

```bash
# Unused exports only (smaller JSON)
npx fallow dead-code --format json --quiet --unused-exports 2>/dev/null || true

# Unused dependencies
npx fallow dead-code --format json --quiet --unused-deps 2>/dev/null || true

# Production code only (excludes tests/stories)
npx fallow dead-code --format json --quiet --production 2>/dev/null || true

# PR-scoped (replace main with the PR base branch)
npx fallow dead-code --format json --quiet --changed-since main 2>/dev/null || true
```

Before deleting a symbol, trace it:

```bash
npx fallow dead-code --format json --quiet --trace app/lib/example.server.ts:myExport 2>/dev/null || true
npx fallow dead-code --format json --quiet --trace-file app/components/example.tsx 2>/dev/null || true
npx fallow dead-code --format json --quiet --trace-dependency some-package 2>/dev/null || true
```

### Step 3: Duplication (optional)

```bash
npm run analyze:dupes 2>/dev/null || true
```

Prioritize clones in `app/lib` and large route files (e.g. `family-recipes.tsx`).

### Step 4: Complexity (optional)

```bash
npm run analyze:health 2>/dev/null || true
```

Flag functions with high cyclomatic/cognitive complexity; tie recommendations to concrete files.

### Step 5: Report to the user

Use this structure:

```markdown
## Fallow code health — mealplanner

### Summary
- Total issues: …
- Highest-impact areas: …

### Recommended actions
1. **Safe now** — …
2. **Verify first** — … (e.g. `prototype/`, barrel re-exports)
3. **Defer** — …

### Findings
| Severity | Type | Location | Notes |
|----------|------|----------|-------|
| … | unused-export | … | … |

### Not in scope
- ESLint / typecheck / test fixes unless linked to a finding
```

Group by impact: unused dependencies → unused files → unused exports → duplication → complexity.

**False-positive checklist** before recommending deletion:

- React Router route modules and `app/routes.ts` exports
- Loader/action exports only referenced from route config
- `.server.ts` modules only imported from other server modules
- Prisma seed-only or CLI-only dependencies (`tsx`, `prisma`)
- `prototype/**` — ask whether to delete the folder or add `ignorePatterns`
- Symbols used only in tests when using `--production`

### Step 6: Fixes (user approval required)

Never run `fallow fix` without explicit user consent.

```bash
npx fallow fix --dry-run --format json --quiet 2>/dev/null || true
# After user approves:
npx fallow fix --yes --format json --quiet 2>/dev/null || true
```

After fixes: `npm run lint`, `npm run test:run`, `npm run typecheck`.

## npm scripts

| Script | Command |
|--------|---------|
| `npm run analyze:dead-code` | Dead code audit (JSON) |
| `npm run analyze:dupes` | Top 20 duplicate clusters |
| `npm run analyze:health` | Complexity hotspots (top 15, scored) |

Pass extra flags after `--`, e.g. `npm run analyze:dead-code -- --unused-exports --production`.

## CI (optional, user-driven)

Fallow is not in PR validation today. Suggest `fallow dead-code --ci --changed-since origin/main` only when the user wants a new check; do not wire CI without approval.

## Additional resources

- Full Fallow CLI/MCP reference: `~/.cursor/skills/fallow-skills/fallow/skills/fallow/SKILL.md`
- Docs: https://docs.fallow.tools
