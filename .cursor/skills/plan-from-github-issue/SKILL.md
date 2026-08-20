---
name: plan-from-github-issue
description: Fetches a GitHub issue by number, analyzes the issue, and produces a detailed implementation plan with assumptions, risks, and test strategy before coding starts. Use when the user asks to plan work from a GitHub issue, references an issue number, or wants implementation planning before starting development.
---

# Plan From GitHub Issue

## Goal

Turn a GitHub issue number into an implementation-ready plan without starting code changes.

## When To Use

Use this skill when:

- The user asks to fetch or review a GitHub issue by number
- The user wants a plan before implementation starts
- The user references work like `issue #123`, `plan issue 45`, or similar

## Workflow

Follow this sequence:

1. Resolve the repository context from git@github.com:sndrem/mealplanner.git
2. Sync `main` and ensure a feature branch (not `main` / `master`) — see Step 2.
3. Fetch the GitHub issue.
4. Summarize the issue in your own words.
5. Have a look at the file AGENT_HANDOFF.md for context of the previous issue resolved
6. Inspect the codebase areas likely affected.
7. Produce a detailed implementation plan.
8. Stop and wait for approval before editing code.

Do not start implementation as part of this skill unless the user explicitly asks for it after reviewing the plan.

## Step 1: Resolve Repository Context

If the repository is not obvious from the current workspace:

- Ask the user for the GitHub repository, or
- Ask for the issue URL instead of only the number

If the repository is known, use that repository with the issue number directly.

## Step 2: Sync Main And Ensure Feature Branch

Before fetching the issue or editing code, start from the latest `main` so the branch does not fall behind and cause merge conflicts later.

**Starting a new issue** (not already on `issue/<number>-*` for this issue):

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b issue/<number>-<short-slug>
```

If the issue number is not known yet, run `gh issue view` first for the title, or use `issue/<number>-plan` temporarily.

**Already on the correct `issue/<number>-*` branch** for this issue with in-progress work: stay on it; do not recreate the branch.

**On a different feature branch** or stale `main`: always run the sync + new branch flow above for the new issue.

Branch naming:

- Prefix with `issue/<number>-` (e.g. `issue/42-fly-deploy`)
- `<short-slug>`: a few lowercase words from the issue title (drop filler words, use hyphens, max ~40 chars)

If `git checkout main` or `git pull` is blocked by uncommitted changes, stop and ask the user — do not force checkout.

Do not commit or push as part of this step unless the user explicitly asks.

See also: `.cursor/rules/issue-implementation-branching.mdc`

## Step 3: Fetch The Issue

Prefer the GitHub CLI.

Use:

```bash
gh issue view <number> --repo <owner>/<repo> --json number,title,body,labels,assignees,state,url
```

If more context is needed, also inspect comments:

```bash
gh issue view <number> --repo <owner>/<repo> --comments
```

Capture:

- Title
- Body
- Acceptance criteria or explicit requirements
- Constraints
- Linked context from comments, if relevant

## Step 4: Summarize Before Planning

Write a short summary that covers:

- The problem being solved
- The expected user or product outcome
- Any unclear or missing requirements

If the issue is ambiguous, call that out clearly before making the plan.

## Step 5: Inspect Relevant Code

Read only the parts of the codebase needed to plan the work well.

Look for:

- Existing routes, components, hooks, services, or utilities involved
- Similar features or patterns already in use
- Constraints from architecture, state, API usage, or styling conventions

Prefer reusing existing patterns over proposing brand new abstractions unless the issue clearly requires them.

## Step 6: Produce The Plan

Use this structure:

```markdown
## Issue Summary

[Short restatement of the issue]

## Assumptions

- [Assumption]

## Open Questions

- [Question that may need confirmation]

## Implementation Plan

1. [First implementation step]
2. [Second implementation step]
3. [Continue as needed]

## Risks

- [Risk or edge case]

## Test Strategy

- [Unit/integration/manual test approach]

## Ready To Implement

[State whether implementation can start now or what is still needed]
```

Plan quality bar:

- Be specific about the files or areas likely to change when you can infer them
- Call out dependencies between steps
- Include edge cases and migration concerns when relevant
- Keep the plan implementation-focused, not generic project-management filler

## Step 7: Stop Before Coding

After presenting the plan:

- Ask the user to confirm or refine it
- Wait for approval before making code changes

## Output Guidelines

- Be concise but concrete
- Prefer actionable steps over broad recommendations
- Highlight uncertainty instead of guessing
- If repository context is missing, ask for it immediately instead of assuming
- When a new branch was created in Step 2, mention its name in the plan so implementation starts on the right branch

## Example Triggers

- `Fetch issue 142 and create a plan`
- `Plan GitHub issue #87 before coding`
- `Read issue 51 and tell me how we should implement it`
