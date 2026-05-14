import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("app", "routes/app.tsx"),
  route("families/:familyId", "routes/family.tsx"),
  route("families/:familyId/meal-plans", "routes/family-meal-plans.tsx"),
  route("families/:familyId/meal-plans/:mealPlanId", "routes/family-meal-plan.tsx"),
  route("families/:familyId/meal-plans/:mealPlanId/shopping", "routes/family-meal-plan-shopping.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("prototype", "routes/prototype.tsx"),
  route("register", "routes/register.tsx"),
] satisfies RouteConfig;
