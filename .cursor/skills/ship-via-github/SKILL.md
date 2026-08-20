---
name: ship-via-github
description: Runs lint, tests, and typecheck, commits and pushes changes, opens a GitHub pull request with gh, and closes the related issue. Use when the user asks to ship work, push and open a PR, create a pull request via GitHub CLI, or run the full validate-commit-push-PR-close-issue workflow.
---

# Ship Via GitHub

## Goal

Validate changes locally, commit only relevant files, push the branch, open a GitHub pull request with `gh`, and close the issue tied to the task.

## Prerequisites

Before starting:

- `gh` is installed and authenticated (`gh auth status`)
- Current branch is not `main` / `master` (create a feature branch first if needed)
- For **new** issue work, branch was created from up-to-date `main` (`git fetch origin && git checkout main && git pull --ff-only origin main`) — see `.cursor/rules/issue-implementation-branching.mdc`
- Default repository: `sndrem/mealplanner` (use current workspace remote if different)

Resolve the related issue number from, in order:

1. Explicit user input (e.g. `issue 42`, `#42`)
2. Branch name (e.g. `42-fix-login`, `issue-42-description`)
3. `AGENT_HANDOFF.md` or recent task context

If no issue number can be resolved, ask the user before opening the PR.

## Workflow

Copy and track progress:

```
- [ ] Step 1: Validate (lint, test, typecheck)
- [ ] Step 2: Update handoff
- [ ] Step 3: Commit
- [ ] Step 4: Push
- [ ] Step 5: Create pull request
- [ ] Step 6: Close related issue
```

### Step 1: Validate

Run checks in this order (same order as CI, minus build unless the user asks for it):

```bash
npm run prisma:generate
npm run lint
npm run test:run
npm run typecheck
```

If any command fails:

- Fix the failure
- Re-run from the failed step through the end
- Do not commit or push until all four pass

Record the exact commands run; use them in the PR description and `AGENT_HANDOFF.md`.

Optional (user-requested or large/risky change): `npm run build`

### Step 2: Update handoff

Apply the [persist-agent-handoff](../persist-agent-handoff/SKILL.md) skill:

- Update `AGENT_HANDOFF.md` with completed work, validation commands that ran, and open items
- Do not claim checks ran unless Step 1 actually passed

### Step 3: Commit

Follow the repository git safety rules:

- Never commit `.env`, credentials, or other secret files
- Never skip hooks (`--no-verify`) unless the user explicitly requests it
- Only create a commit when this workflow (or the user) requires it

Gather context in parallel:

```bash
git status
git diff
git log -5 --oneline
```

Stage only files relevant to the task. Draft a 1–2 sentence commit message focused on **why**, matching recent repo style.

Commit with a HEREDOC:

```bash
git add <paths>
git commit -m "$(cat <<'EOF'
Short subject line

Optional body with why, not a file list.
EOF
)"
git status
```

If the commit hook modifies files, fix and create a **new** commit (do not amend unless amend rules apply).

### Step 4: Push

Check branch tracking first:

```bash
git status
git rev-parse --abbrev-ref @{upstream} 2>/dev/null || true
```

Push:

```bash
git push -u origin HEAD
```

Use `required_permissions: ["all"]` when the environment blocks push.

If push fails due to remote updates, pull/rebase per team convention, re-run validation if conflicts were resolved, then push again.

### Step 5: Create pull request

Use `gh` for all GitHub operations. Include `Closes #<n>` in the body so GitHub auto-closes the issue when the PR merges.

Before creating, confirm the branch is ahead of the base branch and no open PR already exists for it:

```bash
gh pr list --head "$(git branch --show-current)" --state open
```

Create the PR:

```bash
gh pr create --title "Short outcome-focused title" --body "$(cat <<'EOF'
## Summary
- Bullet: what changed and why

## Related issue
Closes #<issue-number>

## Test plan
- [ ] Validation run locally: lint, test:run, typecheck
- [ ] Manual checks (list any UI/flow checks performed)

## Validation
- npm run prisma:generate
- npm run lint
- npm run test:run
- npm run typecheck
EOF
)"
```

Add `--repo sndrem/mealplanner` only when not already in that repository context.

Return the PR URL from `gh` output to the user.

### Step 6: Close related issue

**Default:** rely on `Closes #<issue-number>` in the PR body so the issue closes when the PR merges.

**Immediate close** (only when the user or team policy expects the issue closed before merge):

```bash
gh issue close <issue-number> --repo sndrem/mealplanner
```

Confirm state:

```bash
gh issue view <issue-number> --repo sndrem/mealplanner --json number,state,url
```

## PR description rules

- Include `Closes #<n>` (or `Fixes #<n>`) exactly once for the primary issue
- List validation commands that actually ran in Step 1
- Keep the summary focused on user-visible outcomes
- Do not paste large diffs into the PR body

## Failure handling

| Situation | Action |
|-----------|--------|
| Lint/test/typecheck fails | Fix, re-validate, do not push |
| Nothing to commit | Stop; tell the user the branch has no changes |
| `gh` not authenticated | Run `gh auth login`, retry |
| PR already exists for branch | `gh pr view --web` or `gh pr view --json url` and share URL |
| Wrong issue number | Ask user; edit PR body with `gh pr edit` before close |

## Example triggers

- `Ship this — validate, commit, push, PR, close the issue`
- `Run lint and tests then open a pull request with gh`
- `Push branch and create PR for issue #12`
