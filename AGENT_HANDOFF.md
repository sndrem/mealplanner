# Agent Handoff

## Current Objective

Ship #225 — Thursday weekend-plan reminder emails. Branch `issue/225-weekend-plan-reminder` is validated and ready for PR.

## Completed

- Admins can set, change, or clear a family reminder email on the Familie tab
- Thursday 12:00 Europe/Oslo job emails that address when Saturday or Sunday dinner is unplanned
- Postgres claims the calendar week before send so extra machines or Action retries cannot duplicate mail
- GitHub Action POSTs to a secret job route; `workflow_dispatch` can pass `force`
- Operator set Fly `CRON_SECRET` and GitHub `CRON_SECRET` + `MEALPLANNER_APP_URL`

## Files To Read First

- `app/lib/weekend-plan-reminder.server.ts` - window check, empty Sat/Sun, claim-then-send
- `app/routes/family.tsx` - Helgevarsling form and `save-reminder-email` action
- `.github/workflows/weekend-plan-reminders.yml` - Thursday UTC schedule and force dispatch

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 547 tests passed
- `npm run typecheck` — passed
- Browser — not run

## Open Items

- Manual after merge: save a family email, leave Sat or Sun blank, `workflow_dispatch` with force, confirm one mail; run again same week — no second mail
- Issue #225 closes on PR merge via `Closes #225`

## Next Step

Review and merge the pull request for #225.
