# Agent Handoff

## Current Objective

Ship persisted System / Light / Dark appearance (#261) on branch `issue/261-theme-toggle`. Validation passed; next step is merge of the PR.

## Completed

- User-scoped `ThemePreference` (`SYSTEM` default, `LIGHT`, `DARK`) with migration `20260915150000_add_user_theme_preference`
- Root `<html>` class is `system` | `light` | `dark`; CSS tokens and a class+media `dark:` variant restyle app chrome and store mode
- Authenticated toggle in `AppTopNav` saves via `POST /theme` and applies the html class immediately
- Dark `notice-*` tokens keep store-mode success banners, Basisvarer, and family recipe cards readable

## Files To Read First

- `app/app.css` — page/store/notice tokens for light, dark, and system+dark
- `app/lib/theme-preference.ts` — parse/resolve/html class helpers
- `app/routes/theme.ts` — POST save preference
- `app/components/theme-toggle.tsx` — nav control
- `app/lib/store-mode-theme.ts` — store-mode banners and Basisvarer

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 700 tests passed
- `npm run typecheck` — passed

## Open Items

- Other app notices (meal plans, shopping, family settings) still use raw `bg-emerald-50` / `bg-rose-50` and can look washed in dark mode
- Phone-width nav density with the desktop icon control still needs a real device check

## Next Step

Review and merge the PR for #261 after a logged-in Dark check of the theme toggle, store mode, and recipe list.
