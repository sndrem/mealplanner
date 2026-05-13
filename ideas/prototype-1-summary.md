# Prototype 1 Summary

This document summarizes the current prototype and gives a production-oriented implementation brief for the next agent.

## Purpose

The current prototype is a UX and workflow reference, not a production foundation. It validates the main user flow:

1. Plan meals across one or more weeks.
2. Support partial active weeks, such as `torsdag -> sondag`.
3. Reuse a previous week as a starting point.
4. Automatically generate and manage a shopping list.
5. Switch into a mobile-first shopping mode in the store.
6. Export meal plan entries to iCal as `.ics` files.

The production system should preserve these validated workflows, but move all important logic to server-backed, multi-user, auditable domain models.

## Reference Files

Use these files as the current product reference:

- `ideas/initial-ideas.md`
- `prototype/page.tsx`
- `prototype/model.ts`
- `prototype/calendar.ts`
- `prototype/storage.ts`
- `app/routes/prototype.tsx`

Important: treat the prototype as product guidance and UI inspiration. Do not lift the local-only state architecture directly into production.

## What Prototype 1 Validated

The prototype currently supports:

- Norwegian-first UI
- tab navigation for `Ukeplan`, `Handleliste`, `Butikkmodus`, and `Butikker`
- multiple planning weeks
- explicit `startDate` and `endDate` for each created week
- partial active weeks
- clone/reuse of a previous week
- seeded recipes
- auto-generated shopping items from planned meals
- manual shopping items
- postpone shopping items to later in the selected week
- per-store section ordering
- compact shopping-focused store mode
- iCal export for:
  - one day
  - the whole selected week

The prototype also assumes that a week-like planning window can be shorter than 7 days and currently caps the range at 7 days. Keep that behavior unless product requirements explicitly change.

## Product Requirements To Carry Forward

From `ideas/initial-ideas.md`, the production system must support:

- React Router 7 framework mode
- PostgreSQL
- Prisma ORM
- logged-in users
- self-registration
- family creation and joining via unique code
- family collaboration on meal plans and shopping lists
- administrator role with elevated permissions
- global recipes and family-specific recipes
- multiple meal plans/weeks per family
- meal planning mode and shopping mode
- recipe-connected shopping list generation
- manual shopping list items
- store-specific item grouping/sorting
- per-day and per-week iCal synchronization/export

## Production Architecture Recommendation

Build the production system as a server-first React Router 7 application with route loaders/actions and a clear domain split.

Recommended high-level architecture:

- `app/routes/`
  - route modules for auth, families, meal plans, recipes, stores, shopping, calendar exports
- `app/features/`
  - route-adjacent UI and feature modules
- `app/data/`
  - Prisma client, repositories, queries, transactions, seeds
- `app/services/`
  - domain services for meal planning, shopping list generation, family membership, calendar export
- `app/lib/` only if truly needed for cross-cutting helpers
- `app/ui/`
  - shared presentational components

If the existing project conventions evolve, prefer route-owned modules over large global folders.

## Production Domain Model

The next agent should model the system around these entities.

### Users and family

- `User`
  - id
  - email
  - passwordHash or external auth fields
  - displayName
  - role flags if global admin exists outside family scope
  - timestamps

- `Family`
  - id
  - name
  - joinCode
  - createdByUserId
  - timestamps

- `FamilyMembership`
  - id
  - familyId
  - userId
  - role: `admin | member`
  - status if invites are later added
  - timestamps

### Recipes

- `Recipe`
  - id
  - scope: `global | family`
  - familyId nullable
  - createdByUserId nullable
  - title
  - description
  - defaultServings
  - prepMinutes
  - tags
  - timestamps

- `RecipeIngredient`
  - id
  - recipeId
  - ingredientId nullable
  - displayName
  - amount
  - unit
  - categoryId
  - preferredStoreId nullable
  - sort hints nullable

- `Ingredient`
  - id
  - canonicalName
  - defaultCategoryId

- `IngredientCategory`
  - id
  - key
  - displayName

### Meal planning

- `MealPlan`
  - id
  - familyId
  - title
  - startDate
  - endDate
  - status: `draft | approved`
  - approvedByUserId nullable
  - approvedAt nullable
  - copiedFromMealPlanId nullable
  - timestamps

- `MealPlanEntry`
  - id
  - mealPlanId
  - date
  - mealType: initially `dinner`, but design for more types later
  - recipeId nullable
  - note nullable
  - locked boolean if needed later

### Shopping

- `Store`
  - id
  - familyId nullable if stores are family-owned
  - name
  - timestamps

- `StoreSection`
  - id
  - storeId
  - categoryId
  - displayName
  - sortOrder

- `ShoppingItemOverride`
  - id
  - mealPlanId
  - sourceType: `generated | manual`
  - sourceKey
  - checked
  - postponedUntilDate nullable
  - preferredStoreId nullable
  - note nullable

- `ManualShoppingItem`
  - id
  - mealPlanId
  - name
  - quantity
  - categoryId
  - preferredStoreId nullable
  - buyOnDate nullable
  - note nullable

Recommended design choice:

- generated shopping items should be derived from selected recipes and meal plan entries
- manual items should be persisted directly
- checked/postponed/store-specific state should be persisted as overrides tied to the meal plan

This keeps shopping regeneration deterministic without losing user edits.

### Calendar sync

Start with:

- server-generated `.ics` export endpoints

Later evolve to:

- signed per-family `webcal` feeds
- optional per-user sync subscriptions

Suggested initial routes:

- `GET /families/:familyId/meal-plans/:mealPlanId/calendar.ics`
- `GET /families/:familyId/meal-plans/:mealPlanId/days/:date/calendar.ics`

## Core Workflows To Implement

### 1. Authentication and family onboarding

- user registers or signs in
- user creates a family or joins one by code
- family admin can manage members later

### 2. Meal plan lifecycle

- create meal plan with `startDate` and `endDate`
- enforce initial max range of 7 days
- copy an existing meal plan into a new date range
- set entries per day
- approve the plan

### 3. Shopping list generation

- derive recipe-based items from planned entries
- merge manual items
- support postponed items for later in the same week/range
- support checked state
- support preferred store per item

### 4. Store mode

- choose active store
- sort sections according to family/store configuration
- show only items relevant for the selected shopping date
- optimize for one-handed mobile use

### 5. Calendar export

- export one day
- export the whole meal plan
- include title, date, and recipe description

## Implementation Phases

The next agent should build in phases, not all at once.

### Phase 1: Foundation

- set up Prisma schema and migrations
- add environment handling
- add auth/session strategy
- add base family model and membership model
- add seed data for recipes and categories
- add basic route protection

### Phase 2: Meal planning

- implement meal plan CRUD
- implement meal plan copy/reuse
- support start/end date range
- implement meal plan entry editing
- implement plan approval state

### Phase 3: Shopping list

- implement generated shopping projection
- implement manual shopping items
- implement checked state and postponement
- implement store selection and section ordering
- implement mobile store mode

### Phase 4: Calendar

- add day and week `.ics` export endpoints
- add UI actions
- keep the export logic server-side

### Phase 5: Multi-user collaboration

- real family collaboration
- conflict handling for concurrent edits
- audit-friendly timestamps and actor metadata

## Non-Functional Requirements

The production system should be designed for:

- clear server/client separation
- strong typing end to end
- minimal duplicated business logic
- deterministic shopping generation
- testable domain services
- mobile-first shopping UX
- secure authentication and authorization
- observability for key writes and failures

## Testing Strategy

The next agent should add meaningful automated coverage, not just UI snapshots.

Prioritize tests for:

- meal plan date range validation
- copy/reuse meal plan behavior
- shopping item generation from recipes
- merge logic for generated and manual items
- postponement behavior
- store sorting behavior
- `.ics` export correctness
- authorization boundaries between users, families, and admins

## Guardrails

- Keep the app Norwegian in user-facing text.
- Keep the prototype available as a reference until production routes are ready.
- Do not move production logic into local storage.
- Do not make the shopping list a purely client-side computation in production.
- Do not couple the data model to the exact current prototype component structure.
- Start with dinner as the primary meal type, but design the schema so other meal types can be added later.

## Immediate Next Step For The Next Agent

The next agent should begin with a production data model and server-backed routing, not more prototype work.

Recommended first implementation sequence:

1. Add Prisma and define the first schema for `User`, `Family`, `FamilyMembership`, `Recipe`, `RecipeIngredient`, `MealPlan`, `MealPlanEntry`, `ManualShoppingItem`, `Store`, and `StoreSection`.
2. Add a simple auth/session flow.
3. Build a protected family dashboard route.
4. Implement create/list/select meal plans with `startDate` and `endDate`.
5. Rebuild the current prototype flows on top of real server data one tab at a time.

If there is ambiguity, preserve the validated prototype behavior first and refine after the production baseline works.
