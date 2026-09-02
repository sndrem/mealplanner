import { createHash, randomBytes } from "node:crypto";
import { MealType } from "@prisma/client";

import {
  createCalendarFile,
  createMealPlanCalendarEvent,
  getCalendarMealDetails,
  getFamilyCalendarName,
} from "./calendar.server";
import { db } from "./db.server";
import { requireFamilyAdmin } from "./family.server";
import { formatDateOnly } from "./meal-plan-dates";
import { LIVE_MEAL_PLAN_STATUS_FILTER } from "./meal-plan-status.server";
import {
  getCalendarWeekBounds,
  getCalendarWeekDates,
  getNextCalendarWeekBounds,
} from "./meal-plan-week";

export function hashCalendarSubscriptionToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createCalendarSubscriptionRawToken() {
  return randomBytes(32).toString("hex");
}

export function buildCalendarSubscriptionUrls({
  origin,
  token,
}: {
  origin: string;
  token: string;
}) {
  const path = `/c/${encodeURIComponent(token)}/calendar.ics`;
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const host = new URL(normalizedOrigin).host;

  return {
    httpsUrl: `${normalizedOrigin}${path}`,
    webcalUrl: `webcal://${host}${path}`,
  };
}

export async function getFamilyCalendarSubscriptionStatus({
  familyId,
}: {
  familyId: string;
}) {
  const subscription = await db.calendarSubscription.findUnique({
    select: {
      id: true,
    },
    where: {
      familyId,
    },
  });

  return {
    exists: Boolean(subscription),
  };
}

export async function createOrRotateFamilyCalendarSubscription({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const token = createCalendarSubscriptionRawToken();
  const tokenHash = hashCalendarSubscriptionToken(token);

  await db.$transaction(async (tx) => {
    await tx.calendarSubscription.deleteMany({
      where: {
        familyId,
      },
    });
    await tx.calendarSubscription.create({
      data: {
        createdByUserId: userId,
        familyId,
        tokenHash,
      },
    });
  });

  return {
    token,
  };
}

export async function revokeFamilyCalendarSubscription({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  await db.calendarSubscription.deleteMany({
    where: {
      familyId,
    },
  });
}

export async function getFamilyCalendarFeedByToken(
  token: string,
  referenceDate = new Date(),
) {
  const trimmedToken = token.trim();

  if (!trimmedToken) {
    return null;
  }

  const subscription = await db.calendarSubscription.findUnique({
    select: {
      family: {
        select: {
          id: true,
          name: true,
        },
      },
      familyId: true,
    },
    where: {
      tokenHash: hashCalendarSubscriptionToken(trimmedToken),
    },
  });

  if (!subscription) {
    return null;
  }

  const events = await getFamilyCalendarEvents({
    familyId: subscription.familyId,
    referenceDate,
  });

  return {
    content: createCalendarFile(
      getFamilyCalendarName(subscription.family.name),
      events,
      new Date(),
      {
        includeRefreshInterval: true,
        useEventTimestamps: true,
      },
    ),
  };
}

async function getFamilyCalendarEvents({
  familyId,
  referenceDate,
}: {
  familyId: string;
  referenceDate: Date;
}) {
  const currentWeek = getCalendarWeekBounds(referenceDate);
  const nextWeek = getNextCalendarWeekBounds(referenceDate);
  const windowStart = currentWeek.weekStart;
  const windowEnd = nextWeek.weekEnd;
  const windowStartDate = new Date(`${windowStart}T00:00:00.000Z`);
  const windowEndDate = new Date(`${windowEnd}T00:00:00.000Z`);
  const dates = [
    ...getCalendarWeekDates(currentWeek),
    ...getCalendarWeekDates(nextWeek),
  ];

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
              note: true,
            },
          },
          freezerItemId: true,
          recipe: {
            select: {
              description: true,
              title: true,
            },
          },
          recipeId: true,
          updatedAt: true,
        },
        where: {
          date: {
            gte: windowStartDate,
            lte: windowEndDate,
          },
          mealType: MealType.DINNER,
        },
      },
      id: true,
      startDate: true,
      title: true,
    },
    where: {
      endDate: {
        gte: windowStartDate,
      },
      familyId,
      startDate: {
        lte: windowEndDate,
      },
      status: LIVE_MEAL_PLAN_STATUS_FILTER,
    },
  });

  return dates.flatMap((date) => {
    const coveringPlan = mealPlans.find(
      (plan) =>
        formatDateOnly(plan.startDate) <= date && formatDateOnly(plan.endDate) >= date,
    );
    const entry = coveringPlan?.entries.find(
      (mealPlanEntry) => formatDateOnly(mealPlanEntry.date) === date,
    );
    const meal = entry ? getCalendarMealDetails(entry) : null;

    if (!coveringPlan || !entry || !meal) {
      return [];
    }

    return [
      createMealPlanCalendarEvent({
        date,
        description: meal.description,
        lastModified: entry.updatedAt,
        mealPlanId: coveringPlan.id,
        mealPlanTitle: coveringPlan.title,
        title: meal.title,
      }),
    ];
  });
}
