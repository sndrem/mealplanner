import { MealType } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import {
  formatShortDateLabel,
  formatWeekdayLabel,
  getDinnerMenuLabel,
} from "./meal-plan-display";
import { formatDateOnly, isPlanDateToday } from "./meal-plan-dates";
import { LIVE_MEAL_PLAN_STATUS_FILTER } from "./meal-plan-status.server";
import {
  getCalendarWeekBounds,
  getCalendarWeekDates,
} from "./meal-plan-week";
import { getRecipeImageUrl } from "./r2.server";

export type FamilyWeekDayMenu = {
  date: string;
  dateLabel: string;
  imageUrl: string | null;
  isToday: boolean;
  mealPlanId: string | null;
  mealPlanTitle: string | null;
  menuLabel: string;
  responsibleDisplayName: string | null;
  weekdayLabel: string;
};

export async function getFamilyWeekDinnerMenu({
  familyId,
  referenceDate = new Date(),
  userId,
}: {
  familyId: string;
  referenceDate?: Date;
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const weekBounds = getCalendarWeekBounds(referenceDate);
  const weekDates = getCalendarWeekDates(weekBounds);
  const weekStartDate = new Date(`${weekBounds.weekStart}T00:00:00.000Z`);
  const weekEndDate = new Date(`${weekBounds.weekEnd}T00:00:00.000Z`);

  const mealPlans = await db.mealPlan.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      endDate: true,
      entries: {
        select: {
          date: true,
          freezerItem: {
            select: {
              label: true,
            },
          },
          freezerItemId: true,
          note: true,
          recipe: {
            select: {
              imageKey: true,
              title: true,
            },
          },
          recipeId: true,
          responsibleUser: {
            select: {
              displayName: true,
            },
          },
        },
        where: {
          mealType: MealType.DINNER,
        },
      },
      id: true,
      startDate: true,
      title: true,
    },
    where: {
      endDate: {
        gte: weekStartDate,
      },
      familyId,
      startDate: {
        lte: weekEndDate,
      },
      status: LIVE_MEAL_PLAN_STATUS_FILTER,
    },
  });

  return weekDates.map((date) => {
    const coveringPlan = mealPlans.find(
      (plan) =>
        formatDateOnly(plan.startDate) <= date && formatDateOnly(plan.endDate) >= date,
    );
    const dinnerEntry = coveringPlan?.entries.find(
      (entry) => formatDateOnly(entry.date) === date,
    );

    return {
      date,
      dateLabel: formatShortDateLabel(date),
      imageUrl: getRecipeImageUrl(dinnerEntry?.recipe?.imageKey),
      isToday: isPlanDateToday(date, referenceDate),
      mealPlanId: coveringPlan?.id ?? null,
      mealPlanTitle: coveringPlan?.title ?? null,
      menuLabel: coveringPlan ? getDinnerMenuLabel(dinnerEntry) : "Ingen ukeplan",
      responsibleDisplayName:
        dinnerEntry?.responsibleUser?.displayName ?? null,
      weekdayLabel: formatWeekdayLabel(date),
    } satisfies FamilyWeekDayMenu;
  });
}
