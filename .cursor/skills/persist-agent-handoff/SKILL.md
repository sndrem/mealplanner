---
name: persist-agent-handoff
description: Maintains a repo-root AGENT_HANDOFF.md with a concise snapshot of completed work, validation, risks, and next steps before a commit or pull request. Use when wrapping up coding work, preparing a commit, opening or updating a PR, handing work to the next agent, or continuing from a previous agent handoff.
---

# Persist Agent Handoff

## Goal

Leave the repository in a state where the next agent can understand the latest work quickly by reading `AGENT_HANDOFF.md`.

## When To Use

Use this skill when:

- Wrapping up implementation work
- Preparing to create a commit
- Preparing to open or update a pull request
- Handing work off to another agent
- Picking up work that another agent already summarized

## Core Rules

- Treat `AGENT_HANDOFF.md` as the latest handoff snapshot, not a long-running diary.
- Keep the file concise and current. Replace stale details instead of appending noisy history.
- Never claim tests, linting, or manual checks were run unless they actually were.
- Call out blockers, unfinished work, and risks plainly.
- Prefer concrete file and feature names over generic wording.

## Start-Of-Task Check

Before making substantial changes, read `AGENT_HANDOFF.md` if it exists.

Use it to understand:

- The last task in progress
- What was already completed
- What still needs follow-up
- Which files are the best starting points

If the file is missing, continue normally and create it during wrap-up.

## Wrap-Up Workflow

Before your final commit or pull request wrap-up:

1. Review the work completed in the current task.
2. Confirm which checks actually ran.
3. Update `AGENT_HANDOFF.md` with the latest state.
4. Make sure the file reflects the current snapshot of the branch, including unfinished work.

## Required Sections

Write `AGENT_HANDOFF.md` with this structure:

```markdown
# Agent Handoff

## Current Objective

[One or two sentences describing the active goal or recently completed task.]

## Completed

- [Concrete change]
- [Concrete change]

## Files To Read First

- `path/to/file` - [Why it matters]
- `path/to/file` - [Why it matters]

## Validation

- [Command run or manual check performed]
- [If nothing was run, say `Not run yet.`]

## Open Items

- [Remaining task, risk, or blocker]
- [Anything the next agent should verify]

## Next Step

[Single best next action for the next agent.]
```

## Writing Guidance

- `Current Objective`: Describe the current branch goal, not the whole project.
- `Completed`: Focus on user-visible or structurally important changes.
- `Files To Read First`: List only the few files that matter most for continuing the work.
- `Validation`: Include exact checks that ran, or explicitly say none ran yet.
- `Open Items`: Include bugs, missing polish, unanswered questions, or cleanup still needed.
- `Next Step`: Make this actionable enough that the next agent can start immediately.

## Quality Bar

Good handoffs are:

- Short enough to scan in under a minute
- Specific enough that another agent can resume work without re-discovering context
- Honest about incomplete work and test coverage

Avoid:

- Repeating every file touched
- Copying large diff summaries
- Writing vague notes like `fixed stuff` or `needs testing`

## Example Triggers

- `Create a commit and update the handoff`
- `Open a PR and leave a summary for the next agent`
- `Summarize what changed before wrapping up`
- `Continue from the previous agent handoff`
