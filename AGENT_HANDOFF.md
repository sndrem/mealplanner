# Agent Handoff

## Current Objective

Ship client-only iOS Shortcuts “Påminn meg” on recipe detail. Recipe reminder templates remain [#229](https://github.com/sndrem/mealplanner/issues/229).

## Completed

- `app/lib/recipe-reminder.ts` — payload/URL helpers, presets, platform detection, `createRecipeReminder`
- `RecipeReminderModal` — editable title, presets, custom date/time, Shortcut install help
- **Påminn meg** on `FamilyRecipeEditorCard` for all viewers
- Modal accepts optional `suggestions` for later #229 prefills (not persisted yet)

## Files To Read First

- `app/lib/recipe-reminder.ts` — URL/payload construction and types
- `app/components/recipe-reminder-modal.tsx` — mobile modal UX
- `app/components/family-recipe-editor-card.tsx` — button placement

## Validation

- `npm run prisma:generate` — passed
- `npm run lint` — passed
- `npm run test:run` — 562 tests passed
- `npm run typecheck` — passed
- Browser / iPhone Safari — not run; needs a real device with Shortcut installed

## Open Items

- User must install Shortcut named exactly `Create Recipe Reminder` that parses the JSON text input
- #229: store suggestions on recipes and show them on the meal plan
- Optional: publish an iCloud Shortcut link in the help panel once one exists

## Next Step

Review and merge the PR; then manual check on iPhone Safari.
