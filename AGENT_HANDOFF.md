# Agent Handoff

## Current Objective

Open and merge the pull request for forgot-password (issue #191).

## Completed

- Login has a “Glemt passord?” link; `/forgot-password` always shows a generic success message.
- Hashed, one-time, 1-hour `PasswordResetToken` rows are stored in Postgres; unused tokens are throttled to one send per 15 minutes.
- SMTP mailer (Nodemailer) sends the reset link when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are set. Gmail works without a custom domain via an app password. Otherwise the email (including the reset URL) is logged to the server console.
- A valid `/reset-password?token=` form sets a new scrypt password and signs the user in.
- Reset password UI no longer imports `PASSWORD_MIN_LENGTH` from `auth.server`, so `npm run build` succeeds.

## Files To Read First

- `app/lib/password-reset.server.ts` - token create/validate/reset
- `app/lib/mailer.server.ts` - SMTP send with console fallback
- `app/routes/forgot-password.tsx` - request form
- `app/routes/reset-password.tsx` - set new password (client must not import `.server` modules)

## Validation

- `npm run lint` — passed
- `npm run test:run -- app/routes/reset-password.test.ts` — passed (5 tests)
- `npm run build` — passed

## Open Items

- Set Fly secrets for Gmail SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`) after merge so production can send reset mail.
- Manual check: request a reset, open the email, set a new password, confirm the old password fails.
- Issue #191 closes when the PR merges (`Closes #191`).

## Next Step

Review and merge https://github.com/sndrem/mealplanner/pull/192, then set SMTP Fly secrets.
