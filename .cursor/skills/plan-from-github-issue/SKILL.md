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
2. Fetch the GitHub issue.
3. Summarize the issue in your own words.
4. Have a look at the file AGENT_HANDOFF.md for context of the previous issue resolved
5. Inspect the codebase areas likely affected.
6. Produce a detailed implementation plan.
7. Stop and wait for approval before editing code.

Do not start implementation as part of this skill unless the user explicitly asks for it after reviewing the plan.

## Step 1: Resolve Repository Context

If the repository is not obvious from the current workspace:

- Ask the user for the GitHub repository, or
- Ask for the issue URL instead of only the number

If the repository is known, use that repository with the issue number directly.

## Step 2: Fetch The Issue

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

## Step 3: Summarize Before Planning

Write a short summary that covers:

- The problem being solved
- The expected user or product outcome
- Any unclear or missing requirements

If the issue is ambiguous, call that out clearly before making the plan.

## Step 4: Inspect Relevant Code

Read only the parts of the codebase needed to plan the work well.

Look for:

- Existing routes, components, hooks, services, or utilities involved
- Similar features or patterns already in use
- Constraints from architecture, state, API usage, or styling conventions

Prefer reusing existing patterns over proposing brand new abstractions unless the issue clearly requires them.

## Step 5: Produce The Plan

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

## Step 6: Stop Before Coding

After presenting the plan:

- Ask the user to confirm or refine it
- Wait for approval before making code changes

## Output Guidelines

- Be concise but concrete
- Prefer actionable steps over broad recommendations
- Highlight uncertainty instead of guessing
- If repository context is missing, ask for it immediately instead of assuming

## Example Triggers

- `Fetch issue 142 and create a plan`
- `Plan GitHub issue #87 before coding`
- `Read issue 51 and tell me how we should implement it`
