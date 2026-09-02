import { MealPlanStatus } from "@prisma/client";

export const LIVE_MEAL_PLAN_STATUSES = [
  MealPlanStatus.APPROVED,
  MealPlanStatus.DRAFT,
] as const;

export const LIVE_MEAL_PLAN_STATUS_FILTER = {
  in: [...LIVE_MEAL_PLAN_STATUSES],
};
