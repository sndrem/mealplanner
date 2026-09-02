import { db } from "./db.server";
import { formatDateOnly } from "./meal-plan-dates";
import { toLiveMealPlanStatus } from "./meal-plan-display";
import { LIVE_MEAL_PLAN_STATUS_FILTER } from "./meal-plan-status.server";

const storeModeAnchorMealPlanSelect = {
  id: true,
} as const;

export const FAMILY_SHOPPING_LIST_MODES = ["GLOBAL", "COMBINED"] as const;

export const STORE_MODE_TRIP_FOCUS_VALUES = [
  "CURRENT",
  "NEXT",
  "ALL",
] as const;

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

export type StoreModeTripFocusValue =
  (typeof STORE_MODE_TRIP_FOCUS_VALUES)[number];

export async function findMealPlanCoveringDate({
  familyId,
  referenceDate = new Date(),
}: {
  familyId: string;
  referenceDate?: Date;
}): Promise<MealPlanForDateSummary | null> {
  const dateOnly = formatDateOnly(referenceDate);
  const dateAtUtcMidnight = new Date(`${dateOnly}T00:00:00.000Z`);

  const mealPlan = await db.mealPlan.findFirst({
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
      status: LIVE_MEAL_PLAN_STATUS_FILTER,
    },
  });

  if (!mealPlan) {
    return null;
  }

  return {
    ...mealPlan,
    status: toLiveMealPlanStatus(mealPlan.status),
  };
}

export async function resolveStoreModeAnchorMealPlan({
  familyId,
}: {
  familyId: string;
}): Promise<{ id: string } | null> {
  const todayMealPlan = await findMealPlanCoveringDate({
    familyId,
  });

  if (todayMealPlan) {
    return { id: todayMealPlan.id };
  }

  return db.mealPlan.findFirst({
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: storeModeAnchorMealPlanSelect,
    where: {
      familyId,
      status: LIVE_MEAL_PLAN_STATUS_FILTER,
    },
  });
}

export async function resolveStoreModeNextMealPlan({
  familyId,
  referenceDate = new Date(),
}: {
  familyId: string;
  referenceDate?: Date;
}): Promise<{ id: string } | null> {
  const dateOnly = formatDateOnly(referenceDate);
  const dateAtUtcMidnight = new Date(`${dateOnly}T00:00:00.000Z`);

  return db.mealPlan.findFirst({
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
    select: storeModeAnchorMealPlanSelect,
    where: {
      familyId,
      startDate: {
        gt: dateAtUtcMidnight,
      },
      status: LIVE_MEAL_PLAN_STATUS_FILTER,
    },
  });
}

export function resolveEffectiveStoreModeTripFocus({
  canFocusNext,
  tripFocus,
}: {
  canFocusNext: boolean;
  tripFocus: StoreModeTripFocusValue;
}): StoreModeTripFocusValue {
  if (tripFocus === "NEXT" && !canFocusNext) {
    return "CURRENT";
  }

  return tripFocus;
}

export function selectMealPlansForTripFocus<
  T extends { id: string; startDate: Date },
>({
  anchorPlan,
  currentPlanId,
  focus,
  nextPlanId,
  openPlans,
}: {
  anchorPlan: T;
  currentPlanId: string | null;
  focus: StoreModeTripFocusValue;
  nextPlanId: string | null;
  openPlans: T[];
}): T[] {
  if (focus === "ALL") {
    if (openPlans.some((plan) => plan.id === anchorPlan.id)) {
      return openPlans;
    }

    return [...openPlans, anchorPlan].sort((left, right) => {
      if (left.startDate.getTime() !== right.startDate.getTime()) {
        return left.startDate.getTime() - right.startDate.getTime();
      }

      return left.id.localeCompare(right.id, "nb");
    });
  }

  if (focus === "NEXT" && nextPlanId) {
    const nextPlan =
      openPlans.find((plan) => plan.id === nextPlanId) ??
      (anchorPlan.id === nextPlanId ? anchorPlan : null);

    if (nextPlan) {
      return [nextPlan];
    }
  }

  const resolvedCurrentId = currentPlanId ?? anchorPlan.id;
  const currentPlan =
    openPlans.find((plan) => plan.id === resolvedCurrentId) ??
    (anchorPlan.id === resolvedCurrentId ? anchorPlan : null) ??
    anchorPlan;

  return [currentPlan];
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
