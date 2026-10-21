## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in sndrem/mealplanner. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical labels, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Cookies

Non-session cookies use `createCookie` from `react-router`. `app/lib/session.server.ts` is the session example in that same module.

### Browser checks

The dev server is the signed-in family's real trip. See `docs/agents/browser-checks.md`.
