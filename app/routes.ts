import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("app", "routes/app.tsx"),
  route("families/:familyId", "routes/family.tsx"),
  route("families/:familyId/meal-plans", "routes/family-meal-plans.tsx"),
  route("families/:familyId/meal-plans/:mealPlanId", "routes/family-meal-plan.tsx"),
  route("families/:familyId/meal-plans/:mealPlanId/calendar.ics", "routes/family-meal-plan-calendar.ts"),
  route(
    "families/:familyId/meal-plans/:mealPlanId/days/:date/calendar.ics",
    "routes/family-meal-plan-day-calendar.ts",
  ),
  route("families/:familyId/meal-plans/:mealPlanId/shopping", "routes/family-meal-plan-shopping.tsx"),
  route("families/:familyId/meal-plans/:mealPlanId/store-mode", "routes/family-meal-plan-store-mode.tsx"),
  route("families/:familyId/stores", "routes/family-stores.tsx"),
  route("families/:familyId/stock-ingredients", "routes/family-stock-ingredients.tsx"),
  route("families/:familyId/recipes", "routes/family-recipes.tsx"),
  route("families/:familyId/recipes/import", "routes/family-recipe-import.tsx"),
  route("families/:familyId/recipes/:recipeId", "routes/family-recipe.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("prototype", "routes/prototype.tsx"),
  route("register", "routes/register.tsx"),
] satisfies RouteConfig;
