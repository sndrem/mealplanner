import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("register", "routes/register.tsx"),
  layout("routes/app-layout.tsx", [
    route("app", "routes/app.tsx"),
    route("families/:familyId", "routes/family.tsx"),
    route("families/:familyId/meal-plans", "routes/family-meal-plans.tsx"),
    route(
      "families/:familyId/meal-plans/overview",
      "routes/family-meal-plans-overview.tsx",
    ),
    route("families/:familyId/meal-plans/reviews", "routes/family-meal-plan-reviews.tsx"),
    route(
      "families/:familyId/meal-plans/:mealPlanId/review",
      "routes/family-meal-plan-review.tsx",
    ),
    route("families/:familyId/meal-plans/:mealPlanId", "routes/family-meal-plan.tsx"),
    route(
      "families/:familyId/meal-plans/:mealPlanId/calendar.ics",
      "routes/family-meal-plan-calendar.ts",
    ),
    route(
      "families/:familyId/meal-plans/:mealPlanId/days/:date/calendar.ics",
      "routes/family-meal-plan-day-calendar.ts",
    ),
    route("families/:familyId/meal-plans/:mealPlanId/shopping", "routes/family-meal-plan-shopping.tsx"),
    route(
      "families/:familyId/meal-plans/:mealPlanId/shopping/ingredient-search",
      "routes/family-meal-plan-shopping-ingredient-search.ts",
    ),
    route(
      "families/:familyId/meal-plans/:mealPlanId/store-mode",
      "routes/family-meal-plan-store-mode-redirect.ts",
    ),
    route("families/:familyId/store-mode", "routes/family-meal-plan-store-mode.tsx"),
    route("families/:familyId/shopping", "routes/family-shopping.tsx"),
    route(
      "families/:familyId/shopping/ingredient-search",
      "routes/family-shopping-ingredient-search.ts",
    ),
    route("families/:familyId/stores", "routes/family-stores.tsx"),
    route("families/:familyId/stock-ingredients", "routes/family-stock-ingredients.tsx"),
    route("families/:familyId/shopping-catalog", "routes/family-shopping-catalog.tsx"),
    route("families/:familyId/freezer", "routes/family-freezer.tsx"),
    route("families/:familyId/recipes", "routes/family-recipes.tsx"),
    route("families/:familyId/recipes/:recipeId", "routes/family-recipe.tsx"),
  ]),
] satisfies RouteConfig;
