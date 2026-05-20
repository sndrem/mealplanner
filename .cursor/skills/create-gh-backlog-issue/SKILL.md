---
name: create-gh-backlog-issue
description: Creates GitHub issues for new functionality and captures enough implementation detail for later pickup. Use when the user mentions backlog ideas, future features, follow-up work, or asks to create a GitHub issue for later implementation.
---

# Create GitHub Backlog Issue

## Goal

Create a high-quality GitHub issue for future implementation in the current repository.

## When To Use

Use this skill when:

- The user wants to defer functionality to later work
- The user asks to "create an issue", "add to backlog", or "track this for later"
- A feature request appears during implementation but should not be built now

## Repository Scope

This skill targets only the current repository.

Default repository:

- `sndrem/mealplanner`

If the current workspace repository differs, use the current workspace repository instead of asking the user to choose among repositories.

## Default Labels

Apply these labels by default:

- `enhancement`
- `backlog`

Before creating the issue, verify labels exist. If one or more labels do not exist, continue with labels that do exist and mention which were skipped.

## Workflow

Follow this sequence:

1. Gather missing details for a useful issue (problem, desired outcome, constraints, acceptance criteria).
2. Draft a concise title in outcome-focused language.
3. Build the issue body using the template in this skill.
4. Create the issue with `gh issue create`.
5. Return the issue URL and a short summary of what was captured.

If critical requirements are missing, ask focused follow-up questions before creating the issue.

## Issue Quality Bar

Every issue should include:

- Clear user or product problem
- Proposed solution direction (not full implementation)
- Acceptance criteria that are testable
- Technical notes, dependencies, and risks when known
- Enough context that another agent can pick it up without re-discovery

## Body Template

Use this markdown template:

```markdown
## Summary

[What should be added, and why now or later]

## Problem

[Current limitation or pain point]

## Proposed Solution

[Preferred approach at a high level]

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Technical Notes

- Affected areas: [routes/components/services/tests]
- Reuse patterns: [existing modules or conventions to follow]
- Non-goals: [what is explicitly out of scope]

## Dependencies

- [Dependency, upstream task, or "None"]

## Testing Considerations

- Unit: [what should be covered]
- Integration: [what flows should be verified]
- Manual: [quick manual checks]

## Risks

- [Edge case, migration concern, or "Low risk"]
```

## Commands

Prefer these commands:

```bash
# Optional: verify labels exist
gh label list --limit 200

# Create the issue in the current repository
gh issue create \
  --repo sndrem/mealplanner \
  --title "<title>" \
  --body "<body>" \
  --label "enhancement" \
  --label "backlog"
```

If a default label is missing, retry with only existing labels.

## Response Format

After creating the issue, respond with:

- Issue URL
- Final title
- Applied labels
- One-paragraph summary
- Any assumptions captured in the issue

## Example Triggers

- `Create an issue for adding weekly pantry suggestions later`
- `Track this as backlog work in GitHub`
- `Don't implement now, open an issue for future follow-up`
