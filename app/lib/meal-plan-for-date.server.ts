import { db } from "./db.server";
import { formatDateOnly } from "./meal-plan-dates";

export const FAMILY_SHOPPING_LIST_MODES = ["GLOBAL", "COMBINED"] as const;

const mealPlanForDateSelect = {
  endDate: true,
  id: true,
  startDate: true,
  status: true,
  title: true,
} as const;

export type MealPlanForDateSummary = {
  endDate: Date;
  id: string;
  startDate: Date;
  status: "APPROVED" | "DRAFT";
  title: string;
};

export async function findMealPlanCoveringDate({
  familyId,
  referenceDate = new Date(),
}: {
  familyId: string;
  referenceDate?: Date;
}): Promise<MealPlanForDateSummary | null> {
  const dateOnly = formatDateOnly(referenceDate);
  const dateAtUtcMidnight = new Date(`${dateOnly}T00:00:00.000Z`);

  return db.mealPlan.findFirst({
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: mealPlanForDateSelect,
    where: {
      familyId,
      endDate: {
        gte: dateAtUtcMidnight,
      },
      startDate: {
        lte: dateAtUtcMidnight,
      },
    },
  });
}

export function serializeMealPlanForDateSummary(plan: MealPlanForDateSummary) {
  return {
    id: plan.id,
    status: plan.status,
    title: plan.title,
  };
}

export type FamilyShoppingListModeValue =
  (typeof FAMILY_SHOPPING_LIST_MODES)[number];
