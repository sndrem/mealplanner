import { randomInt } from "node:crypto";

import { MealPlanStatus, MealType, Prisma, RecipeScope } from "@prisma/client";

import {
  buildActorUpdate,
  buildMealPlanEntriesSnapshot,
  COLLABORATION_APPROVAL_CONFLICT_MESSAGE,
  COLLABORATION_CONFLICT_MESSAGE,
  matchesExpectedUpdatedAt,
} from "./collaboration.server";
import { db } from "./db.server";
import {
  listFamilyMembers,
  requireFamilyMembership,
} from "./family.server";
import {
  computeFreezerStockDelta,
  validateFreezerStockDelta,
} from "./freezer-stock.server";
import { listActiveFreezerItemsForPlanning } from "./freezer.server";
import { normalizeIngredientCanonicalName } from "./ingredient-normalize";
import { formatDateOnly, MEAL_PLAN_MAX_SPAN_DAYS, getMealPlanMaxSpanMessage } from "./meal-plan-dates";
import {
  logCollaborationFailure,
  logCollaborationWrite,
} from "./write-observability.server";

export {
  formatDateOnly,
  getMealPlanMaxSpanMessage,
  isPlanDateToday,
  MEAL_PLAN_MAX_SPAN_DAYS,
} from "./meal-plan-dates";

const MEAL_PLAN_MAX_DAY_OFFSET = MEAL_PLAN_MAX_SPAN_DAYS - 1;

const mealPlanSummarySelect = {
  activeShoppingDate: true,
  createdAt: true,
  endDate: true,
  id: true,
  startDate: true,
  status: true,
  title: true,
  updatedAt: true,
};

const mealPlanDetailSelect = {
  ...mealPlanSummarySelect,
  approvedAt: true,
  approvedByUserId: true,
  copiedFromMealPlanId: true,
};

const recipeOptionSelect = Prisma.validator<Prisma.RecipeSelect>()({
  defaultServings: true,
  description: true,
  id: true,
  prepMinutes: true,
  tags: true,
  title: true,
});

const freezerItemOptionSelect = Prisma.validator<Prisma.FamilyFreezerItemSelect>()({
  id: true,
  label: true,
  note: true,
  quantity: true,
});

const mealPlanEntrySelect = Prisma.validator<Prisma.MealPlanEntrySelect>()({
  createdAt: true,
  date: true,
  freezerItem: {
    select: freezerItemOptionSelect,
  },
  freezerItemId: true,
  id: true,
  locked: true,
  mealType: true,
  note: true,
  recipe: {
    select: recipeOptionSelect,
  },
  recipeId: true,
  responsibleUser: {
    select: {
      displayName: true,
      id: true,
    },
  },
  responsibleUserId: true,
  updatedAt: true,
});

const mealPlanPlanningDetailSelect = Prisma.validator<Prisma.MealPlanSelect>()({
  activeShoppingDate: true,
  approvedAt: true,
  approvedByUserId: true,
  copiedFromMealPlanId: true,
  createdAt: true,
  endDate: true,
  entries: {
    orderBy: [{ date: "asc" }, { mealType: "asc" }],
    select: mealPlanEntrySelect,
  },
  id: true,
  startDate: true,
  status: true,
  title: true,
  updatedAt: true,
});

const PLANNING_MEAL_TYPE = MealType.DINNER;

export interface MealPlanFieldErrors {
  endDate?: string;
  startDate?: string;
  title?: string;
}

interface MealPlanValues {
  endDate: string;
  startDate: string;
  title: string;
}

type MealPlanValidationResult =
  | {
      ok: true;
      values: MealPlanValues;
    }
  | {
      fieldErrors: MealPlanFieldErrors;
      ok: false;
      values: MealPlanValues;
    };

interface MealPlanMutationInput {
  endDate: string;
  familyId: string;
  startDate: string;
  title: string;
  userId: string;
}

interface CopyMealPlanInput extends MealPlanMutationInput {
  sourceMealPlanId: string;
}

export interface MealPlanEntryValues {
  date: string;
  freezerItemId: string;
  note: string;
  recipeId: string;
  responsibleUserId: string;
}

interface SaveMealPlanEntriesInput {
  entries: MealPlanEntryValues[];
  entryVersions: Record<string, string>;
  familyId: string;
  mealPlanId: string;
  userId: string;
}

interface DeleteMealPlanInput {
  familyId: string;
  mealPlanId: string;
  userId: string;
}

interface MealPlanApprovalInput extends DeleteMealPlanInput {
  entriesSnapshot: string;
  expectedMealPlanUpdatedAt: string;
}

interface UpdateMealPlanInput extends MealPlanMutationInput {
  expectedMealPlanUpdatedAt: string;
  mealPlanId: string;
}

type GetMealPlanInput = DeleteMealPlanInput;

interface MealPlanListInput {
  familyId: string;
  userId: string;
}

type MealPlanPlanningInput = GetMealPlanInput;

type AutoFillMealPlanEntriesInput = DeleteMealPlanInput;

type MealPlanApprovalAction = "APPROVE" | "REOPEN";
export type DinnerAnalyticsTimeframe = "30d" | "90d" | "all";

export interface DinnerIngredientUsageStat {
  count: number;
  ingredientName: string;
}

export interface DinnerRecipeUsageStat {
  count: number;
  recipeId: string;
  recipeTitle: string;
}

export interface DinnerLatestRecipeUsageStat {
  date: Date;
  recipeId: string;
  recipeTitle: string;
}

const AUTO_FILL_NOT_DRAFT_MESSAGE =
  "Godkjente ukeplaner kan ikke fylles automatisk.";
const AUTO_FILL_NO_ELIGIBLE_RECIPES_MESSAGE =
  `Ingen tilgjengelige oppskrifter etter a ha utelatt middager fra de siste ${MEAL_PLAN_MAX_SPAN_DAYS} dagene.`;
const AUTO_FILL_REPEAT_WARNING_MESSAGE =
  "Noen middager ble valgt flere ganger fordi det var for fa oppskrifter igjen.";
const ANALYTICS_TOP_INGREDIENT_LIMIT = 20;
const ANALYTICS_TOP_RECIPE_LIMIT = 20;
const ANALYTICS_LATEST_RECIPE_LIMIT = 15;

export function getMealPlanDateRange(startDate: Date, endDate: Date) {
  let currentDate = new Date(startDate.getTime());
  let dates: string[] = [];

  while (currentDate.getTime() <= endDate.getTime()) {
    dates.push(formatDateOnly(currentDate));
    currentDate = addUtcDays(currentDate, 1);
  }

  return dates;
}

export function unionMealPlanDateRanges(
  plans: Array<{ endDate: Date; startDate: Date }>,
) {
  const dateSet = new Set<string>();

  for (const plan of plans) {
    for (const date of getMealPlanDateRange(plan.startDate, plan.endDate)) {
      dateSet.add(date);
    }
  }

  return [...dateSet].sort();
}

export function validateMealPlanRange(
  startDate: string,
  endDate: string,
): MealPlanValidationResult {
  const values = {
    endDate: endDate.trim(),
    startDate: startDate.trim(),
    title: "",
  };
  const fieldErrors: MealPlanFieldErrors = {};

  if (!values.startDate) {
    fieldErrors.startDate = "Velg en startdato.";
  }

  if (!values.endDate) {
    fieldErrors.endDate = "Velg en sluttdato.";
  }

  if (fieldErrors.startDate || fieldErrors.endDate) {
    return {
      fieldErrors,
      ok: false,
      values,
    };
  }

  const parsedStartDate = parseDateOnly(values.startDate);
  const parsedEndDate = parseDateOnly(values.endDate);

  if (!parsedStartDate) {
    fieldErrors.startDate = "Startdatoen er ugyldig.";
  }

  if (!parsedEndDate) {
    fieldErrors.endDate = "Sluttdatoen er ugyldig.";
  }

  if (fieldErrors.startDate || fieldErrors.endDate) {
    return {
      fieldErrors,
      ok: false,
      values,
    };
  }

  if (!parsedStartDate || !parsedEndDate) {
    return {
      fieldErrors,
      ok: false,
      values,
    };
  }

  if (parsedEndDate.getTime() < parsedStartDate.getTime()) {
    return {
      fieldErrors: {
        endDate: "Sluttdatoen kan ikke være før startdatoen.",
      },
      ok: false,
      values,
    };
  }

  const spanInDays = differenceInUtcDays(parsedStartDate, parsedEndDate);

  if (spanInDays > MEAL_PLAN_MAX_DAY_OFFSET) {
    return {
      fieldErrors: {
        endDate: getMealPlanMaxSpanMessage(),
      },
      ok: false,
      values,
    };
  }

  return {
    ok: true,
    values,
  };
}

export async function listMealPlansForFamily({
  familyId,
  userId,
}: MealPlanListInput) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });

  const mealPlans = await db.mealPlan.findMany({
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: mealPlanSummarySelect,
    where: {
      familyId,
    },
  });

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    mealPlans,
    userRole: membership.role,
  };
}

export async function getMealPlanForFamily({
  familyId,
  mealPlanId,
  userId,
}: GetMealPlanInput) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });

  const mealPlan = await db.mealPlan.findFirst({
    select: mealPlanDetailSelect,
    where: {
      familyId,
      id: mealPlanId,
    },
  });

  if (!mealPlan) {
    throw new Response("Fant ikke ukeplanen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    mealPlan,
    userRole: membership.role,
  };
}

export async function getMealPlanPlanningData({
  familyId,
  mealPlanId,
  userId,
}: MealPlanPlanningInput) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });

  const mealPlan = await db.mealPlan.findFirst({
    select: mealPlanPlanningDetailSelect,
    where: {
      familyId,
      id: mealPlanId,
    },
  });

  if (!mealPlan) {
    throw new Response("Fant ikke ukeplanen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const recipes = await db.recipe.findMany({
    orderBy: [{ title: "asc" }],
    select: recipeOptionSelect,
    where: {
      OR: [
        { scope: RecipeScope.GLOBAL },
        { familyId, scope: RecipeScope.FAMILY },
      ],
    },
  });
  const assignedFreezerItemIds = mealPlan.entries
    .filter((entry) => entry.mealType === PLANNING_MEAL_TYPE)
    .map((entry) => entry.freezerItemId)
    .filter((freezerItemId): freezerItemId is string => Boolean(freezerItemId));
  const freezerItems = await listActiveFreezerItemsForPlanning({
    familyId,
    includeItemIds: assignedFreezerItemIds,
    userId,
  });

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    freezerItems,
    mealPlan,
    recipes,
    userRole: membership.role,
    visibleDates: getMealPlanDateRange(mealPlan.startDate, mealPlan.endDate),
  };
}

export async function createMealPlan(input: MealPlanMutationInput) {
  const membership = await requireFamilyMembership({
    familyId: input.familyId,
    userId: input.userId,
  });
  const validation = validateMealPlanInput(input);

  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  const startDate = parseDateOnly(validation.values.startDate)!;
  const endDate = parseDateOnly(validation.values.endDate)!;
  const mealPlan = await db.mealPlan.create({
    data: {
      activeShoppingDate: startDate,
      endDate,
      familyId: input.familyId,
      startDate,
      title: validation.values.title,
    },
    select: mealPlanDetailSelect,
  });

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    mealPlan,
    status: "CREATED" as const,
  };
}

export async function copyMealPlan(input: CopyMealPlanInput) {
  const membership = await requireFamilyMembership({
    familyId: input.familyId,
    userId: input.userId,
  });
  const validation = validateMealPlanInput(input);

  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  const result = await db.$transaction(async (tx) => {
    const sourceMealPlan = await tx.mealPlan.findFirst({
      select: {
        entries: {
          orderBy: [{ date: "asc" }],
          select: {
            date: true,
            note: true,
            recipeId: true,
            responsibleUserId: true,
          },
          where: {
            mealType: PLANNING_MEAL_TYPE,
          },
        },
        id: true,
        startDate: true,
      },
      where: {
        familyId: input.familyId,
        id: input.sourceMealPlanId,
      },
    });

    if (!sourceMealPlan) {
      return {
        status: "NOT_FOUND" as const,
      };
    }

    const startDate = parseDateOnly(validation.values.startDate)!;
    const endDate = parseDateOnly(validation.values.endDate)!;
    const mealPlan = await tx.mealPlan.create({
      data: {
        activeShoppingDate: startDate,
        copiedFromMealPlanId: sourceMealPlan.id,
        endDate,
        familyId: input.familyId,
        startDate,
        title: validation.values.title,
      },
      select: mealPlanDetailSelect,
    });
    const copiedEntries = sourceMealPlan.entries.flatMap((entry) => {
      if (!entry.note && !entry.recipeId) {
        return [];
      }

      const dayOffset = differenceInUtcDays(
        sourceMealPlan.startDate,
        entry.date,
      );
      const targetDate = addUtcDays(startDate, dayOffset);

      if (targetDate.getTime() > endDate.getTime()) {
        return [];
      }

      return [
        {
          date: targetDate,
          mealPlanId: mealPlan.id,
          mealType: PLANNING_MEAL_TYPE,
          note: entry.note,
          recipeId: entry.recipeId,
          responsibleUserId: entry.responsibleUserId,
        },
      ];
    });

    if (copiedEntries.length > 0) {
      await tx.mealPlanEntry.createMany({
        data: copiedEntries,
      });
    }

    return {
      mealPlan,
      status: "CREATED" as const,
    };
  });

  if (result.status === "NOT_FOUND") {
    return result;
  }

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    mealPlan: result.mealPlan,
    status: "CREATED" as const,
  };
}

export async function approveMealPlan(input: MealPlanApprovalInput) {
  return updateMealPlanApprovalState(input, "APPROVE");
}

export async function reopenMealPlan(input: MealPlanApprovalInput) {
  return updateMealPlanApprovalState(input, "REOPEN");
}

export async function updateMealPlan(input: UpdateMealPlanInput) {
  await requireFamilyMembership({
    familyId: input.familyId,
    userId: input.userId,
  });

  const existingMealPlan = await db.mealPlan.findFirst({
    select: {
      activeShoppingDate: true,
      id: true,
      updatedAt: true,
    },
    where: {
      familyId: input.familyId,
      id: input.mealPlanId,
    },
  });

  if (!existingMealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  if (
    !matchesExpectedUpdatedAt(
      input.expectedMealPlanUpdatedAt,
      existingMealPlan.updatedAt,
    )
  ) {
    logCollaborationWrite({
      action: "update-meal-plan",
      domain: "meal-plan",
      entityId: existingMealPlan.id,
      entityType: "meal-plan",
      familyId: input.familyId,
      mealPlanId: existingMealPlan.id,
      outcome: "CONFLICT",
      userId: input.userId,
    });

    return {
      formError: COLLABORATION_CONFLICT_MESSAGE,
      status: "CONFLICT" as const,
    };
  }

  const validation = validateMealPlanInput(input);

  if (!validation.ok) {
    logCollaborationWrite({
      action: "update-meal-plan",
      domain: "meal-plan",
      entityId: existingMealPlan.id,
      entityType: "meal-plan",
      familyId: input.familyId,
      mealPlanId: existingMealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId: input.userId,
    });

    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  const nextStartDate = parseDateOnly(validation.values.startDate)!;
  const nextEndDate = parseDateOnly(validation.values.endDate)!;

  try {
    const mealPlan = await db.$transaction(async (tx) => {
      const updateResult = await tx.mealPlan.updateMany({
        data: {
          activeShoppingDate: clampShoppingDateToRange(
            existingMealPlan.activeShoppingDate,
            nextStartDate,
            nextEndDate,
          ),
          endDate: nextEndDate,
          startDate: nextStartDate,
          title: validation.values.title,
          ...buildActorUpdate(input.userId),
        },
        where: {
          id: existingMealPlan.id,
          updatedAt: existingMealPlan.updatedAt,
        },
      });

      if (updateResult.count === 0) {
        return null;
      }

      await tx.mealPlanEntry.deleteMany({
        where: {
          mealPlanId: existingMealPlan.id,
          OR: [
            { date: { lt: nextStartDate } },
            { date: { gt: nextEndDate } },
          ],
        },
      });

      await tx.manualShoppingItem.updateMany({
        data: {
          buyOnDate: nextStartDate,
        },
        where: {
          mealPlanId: existingMealPlan.id,
          OR: [
            { buyOnDate: { lt: nextStartDate } },
            { buyOnDate: { gt: nextEndDate } },
          ],
        },
      });

      await tx.shoppingItemOverride.updateMany({
        data: {
          postponedUntilDate: nextStartDate,
        },
        where: {
          mealPlanId: existingMealPlan.id,
          OR: [
            { postponedUntilDate: { lt: nextStartDate } },
            { postponedUntilDate: { gt: nextEndDate } },
          ],
        },
      });

      return tx.mealPlan.findUniqueOrThrow({
        select: mealPlanDetailSelect,
        where: {
          id: existingMealPlan.id,
        },
      });
    });

    if (!mealPlan) {
      logCollaborationWrite({
        action: "update-meal-plan",
        domain: "meal-plan",
        entityId: existingMealPlan.id,
        entityType: "meal-plan",
        familyId: input.familyId,
        mealPlanId: existingMealPlan.id,
        outcome: "CONFLICT",
        userId: input.userId,
      });

      return {
        formError: COLLABORATION_CONFLICT_MESSAGE,
        status: "CONFLICT" as const,
      };
    }

    logCollaborationWrite({
      action: "update-meal-plan",
      domain: "meal-plan",
      entityId: existingMealPlan.id,
      entityType: "meal-plan",
      familyId: input.familyId,
      mealPlanId: existingMealPlan.id,
      outcome: "UPDATED",
      userId: input.userId,
    });

    return {
      mealPlan,
      status: "UPDATED" as const,
    };
  } catch (error) {
    logCollaborationFailure({
      action: "update-meal-plan",
      domain: "meal-plan",
      entityId: existingMealPlan.id,
      entityType: "meal-plan",
      error,
      familyId: input.familyId,
      mealPlanId: existingMealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId: input.userId,
    });

    throw error;
  }
}

export async function deleteMealPlan({
  familyId,
  mealPlanId,
  userId,
}: DeleteMealPlanInput) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const mealPlan = await db.mealPlan.findFirst({
    select: {
      id: true,
      title: true,
    },
    where: {
      familyId,
      id: mealPlanId,
    },
  });

  if (!mealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  await db.mealPlan.delete({
    where: {
      id: mealPlan.id,
    },
  });

  return {
    deletedMealPlan: mealPlan,
    status: "DELETED" as const,
  };
}

export async function getDinnerAnalyticsForFamily({
  familyId,
  timeframe,
  userId,
}: {
  familyId: string;
  timeframe: DinnerAnalyticsTimeframe;
  userId: string;
}) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });
  const startDate = getDinnerAnalyticsStartDate(timeframe, new Date());
  const dinnerEntries = await db.mealPlanEntry.findMany({
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: {
      date: true,
      id: true,
      recipe: {
        select: {
          id: true,
          ingredients: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              displayName: true,
            },
          },
          title: true,
        },
      },
      recipeId: true,
    },
    where: {
      ...(startDate ? { date: { gte: startDate } } : {}),
      mealPlan: {
        familyId,
      },
      mealType: PLANNING_MEAL_TYPE,
      recipeId: {
        not: null,
      },
    },
  });
  const recipeUsageById = new Map<string, DinnerRecipeUsageStat>();
  const ingredientUsageByCanonicalName = new Map<
    string,
    DinnerIngredientUsageStat
  >();

  for (const entry of dinnerEntries) {
    if (!entry.recipe) {
      continue;
    }

    const existingRecipeUsage = recipeUsageById.get(entry.recipe.id);
    recipeUsageById.set(entry.recipe.id, {
      count: (existingRecipeUsage?.count ?? 0) + 1,
      recipeId: entry.recipe.id,
      recipeTitle: entry.recipe.title,
    });

    for (const ingredient of entry.recipe.ingredients) {
      const ingredientName = ingredient.displayName.trim();

      if (!ingredientName) {
        continue;
      }

      const canonicalName = normalizeIngredientCanonicalName(ingredientName);
      const existingIngredientUsage =
        ingredientUsageByCanonicalName.get(canonicalName);

      ingredientUsageByCanonicalName.set(canonicalName, {
        count: (existingIngredientUsage?.count ?? 0) + 1,
        ingredientName: existingIngredientUsage?.ingredientName ?? ingredientName,
      });
    }
  }

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    latestRecipesUsed: dinnerEntries
      .flatMap((entry) => {
        if (!entry.recipe) {
          return [];
        }

        return [
          {
            date: entry.date,
            recipeId: entry.recipe.id,
            recipeTitle: entry.recipe.title,
          },
        ];
      })
      .slice(0, ANALYTICS_LATEST_RECIPE_LIMIT),
    mostUsedIngredients: [...ingredientUsageByCanonicalName.values()]
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.ingredientName.localeCompare(right.ingredientName, "nb");
      })
      .slice(0, ANALYTICS_TOP_INGREDIENT_LIMIT),
    mostUsedRecipes: [...recipeUsageById.values()]
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.recipeTitle.localeCompare(right.recipeTitle, "nb");
      })
      .slice(0, ANALYTICS_TOP_RECIPE_LIMIT),
    timeframe,
    timeframeStartDate: startDate,
  };
}

export async function getRecentlyUsedRecipeIds({
  beforeDate,
  currentMealPlanId,
  familyId,
}: {
  beforeDate: Date;
  currentMealPlanId: string;
  familyId: string;
}) {
  const lookbackStart = addUtcDays(beforeDate, -MEAL_PLAN_MAX_SPAN_DAYS);
  const recentEntries = await db.mealPlanEntry.findMany({
    select: {
      recipeId: true,
    },
    where: {
      date: {
        gte: lookbackStart,
        lt: beforeDate,
      },
      mealPlan: {
        familyId,
        id: {
          not: currentMealPlanId,
        },
      },
      mealType: PLANNING_MEAL_TYPE,
      recipeId: {
        not: null,
      },
    },
  });

  return new Set(
    recentEntries
      .map((entry) => entry.recipeId)
      .filter((recipeId): recipeId is string => Boolean(recipeId)),
  );
}

export async function autoFillMealPlanEntries({
  familyId,
  mealPlanId,
  userId,
}: AutoFillMealPlanEntriesInput) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const mealPlan = await db.mealPlan.findFirst({
    select: mealPlanPlanningDetailSelect,
    where: {
      familyId,
      id: mealPlanId,
    },
  });

  if (!mealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  if (mealPlan.status !== MealPlanStatus.DRAFT) {
    return {
      formError: AUTO_FILL_NOT_DRAFT_MESSAGE,
      status: "NOT_DRAFT" as const,
    };
  }

  const visibleDates = getMealPlanDateRange(
    mealPlan.startDate,
    mealPlan.endDate,
  );
  const dinnerEntriesByDate = new Map(
    mealPlan.entries
      .filter((entry) => entry.mealType === PLANNING_MEAL_TYPE)
      .map((entry) => [formatDateOnly(entry.date), entry]),
  );
  const targetDates = visibleDates.filter((date) => {
    const entry = dinnerEntriesByDate.get(date);

    return !entry?.recipeId && !entry?.note && !entry?.freezerItemId;
  });

  if (targetDates.length === 0) {
    return {
      filledCount: 0,
      status: "NOTHING_TO_FILL" as const,
    };
  }

  const recipes = await db.recipe.findMany({
    orderBy: [{ title: "asc" }],
    select: {
      id: true,
    },
    where: {
      OR: [
        { scope: RecipeScope.GLOBAL },
        { familyId, scope: RecipeScope.FAMILY },
      ],
    },
  });
  const excludedRecipeIds = await getRecentlyUsedRecipeIds({
    beforeDate: mealPlan.startDate,
    currentMealPlanId: mealPlan.id,
    familyId,
  });
  const eligibleRecipeIds = recipes
    .map((recipe) => recipe.id)
    .filter((recipeId) => !excludedRecipeIds.has(recipeId));

  if (eligibleRecipeIds.length === 0) {
    return {
      formError: AUTO_FILL_NO_ELIGIBLE_RECIPES_MESSAGE,
      status: "NO_ELIGIBLE_RECIPES" as const,
    };
  }

  const usedRecipeIdsInPlan = new Set(
    [...dinnerEntriesByDate.values()]
      .map((entry) => entry.recipeId)
      .filter((recipeId): recipeId is string => Boolean(recipeId)),
  );
  const { assignments, hadRepeats } = assignRecipesToDates({
    eligibleRecipeIds,
    targetDateCount: targetDates.length,
    usedRecipeIdsInPlan,
  });
  const assignmentsByDate = new Map(
    targetDates.map((date, index) => [date, assignments[index]!]),
  );
  const entries = visibleDates.map((date) => {
    const existingEntry = dinnerEntriesByDate.get(date);
    const assignedRecipeId = assignmentsByDate.get(date);

    if (assignedRecipeId) {
      return {
        date,
        freezerItemId: "",
        note: "",
        recipeId: assignedRecipeId,
        responsibleUserId: existingEntry?.responsibleUserId ?? "",
      };
    }

    return {
      date,
      freezerItemId: existingEntry?.freezerItemId ?? "",
      note: existingEntry?.note ?? "",
      recipeId: existingEntry?.recipeId ?? "",
      responsibleUserId: existingEntry?.responsibleUserId ?? "",
    };
  });
  const entryVersions = Object.fromEntries(
    visibleDates.map((date) => [
      date,
      dinnerEntriesByDate.get(date)?.updatedAt.toISOString() ?? "",
    ]),
  );
  const saveResult = await saveMealPlanEntries({
    entries,
    entryVersions,
    familyId,
    mealPlanId,
    userId,
  });

  if (saveResult.status !== "UPDATED") {
    return saveResult;
  }

  return {
    excludedCount: excludedRecipeIds.size,
    filledCount: targetDates.length,
    status: "AUTO_FILLED" as const,
    warning: hadRepeats ? AUTO_FILL_REPEAT_WARNING_MESSAGE : undefined,
  };
}

export async function saveMealPlanEntries({
  entries,
  entryVersions,
  familyId,
  mealPlanId,
  userId,
}: SaveMealPlanEntriesInput) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const mealPlan = await db.mealPlan.findFirst({
    select: {
      endDate: true,
      id: true,
      startDate: true,
    },
    where: {
      familyId,
      id: mealPlanId,
    },
  });

  if (!mealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  const values = entries.map(normalizeMealPlanEntryValues);
  const validationError = validateMealPlanEntries(
    values,
    mealPlan.startDate,
    mealPlan.endDate,
  );

  if (validationError) {
    logCollaborationWrite({
      action: "save-meal-plan-entries",
      domain: "meal-plan",
      entityType: "meal-plan-entry",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    return {
      formError: validationError,
      status: "VALIDATION_ERROR" as const,
      values,
    };
  }

  const recipeIds = [
    ...new Set(values.map((entry) => entry.recipeId).filter(Boolean)),
  ];

  if (recipeIds.length > 0) {
    const recipes = await db.recipe.findMany({
      select: {
        id: true,
      },
      where: {
        id: {
          in: recipeIds,
        },
        OR: [
          { scope: RecipeScope.GLOBAL },
          { familyId, scope: RecipeScope.FAMILY },
        ],
      },
    });

    if (recipes.length !== recipeIds.length) {
      logCollaborationWrite({
        action: "save-meal-plan-entries",
        domain: "meal-plan",
        entityType: "meal-plan-entry",
        familyId,
        mealPlanId: mealPlan.id,
        outcome: "VALIDATION_ERROR",
        userId,
      });

      return {
        formError:
          "Minst en valgt oppskrift er ikke tilgjengelig for familien.",
        status: "VALIDATION_ERROR" as const,
        values,
      };
    }
  }

  if (values.some((entry) => entry.recipeId && entry.freezerItemId)) {
    logCollaborationWrite({
      action: "save-meal-plan-entries",
      domain: "meal-plan",
      entityType: "meal-plan-entry",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    return {
      formError: "En dag kan ikke ha både oppskrift og fryserrett.",
      status: "VALIDATION_ERROR" as const,
      values,
    };
  }

  const freezerItemIds = [
    ...new Set(values.map((entry) => entry.freezerItemId).filter(Boolean)),
  ];

  if (freezerItemIds.length > 0) {
    const freezerItems = await db.familyFreezerItem.findMany({
      select: {
        id: true,
      },
      where: {
        familyId,
        id: {
          in: freezerItemIds,
        },
      },
    });

    if (freezerItems.length !== freezerItemIds.length) {
      logCollaborationWrite({
        action: "save-meal-plan-entries",
        domain: "meal-plan",
        entityType: "meal-plan-entry",
        familyId,
        mealPlanId: mealPlan.id,
        outcome: "VALIDATION_ERROR",
        userId,
      });

      return {
        formError: "Minst en valgt fryserrett er ikke tilgjengelig for familien.",
        status: "VALIDATION_ERROR" as const,
        values,
      };
    }
  }

  const previousFreezerEntries = await db.mealPlanEntry.findMany({
    select: {
      date: true,
      freezerItemId: true,
    },
    where: {
      mealPlanId: mealPlan.id,
      mealType: PLANNING_MEAL_TYPE,
    },
  });
  const previousFreezerByDate = new Map(
    previousFreezerEntries.map((entry) => [
      formatDateOnly(entry.date),
      entry.freezerItemId,
    ]),
  );
  const nextFreezerByDate = new Map(
    values.map((entry) => [entry.date, entry.freezerItemId || null]),
  );
  const freezerStockDelta = computeFreezerStockDelta({
    nextEntries: nextFreezerByDate,
    previousEntries: previousFreezerByDate,
  });

  if (freezerStockDelta.size > 0) {
    const affectedFreezerItems = await db.familyFreezerItem.findMany({
      select: {
        id: true,
        quantity: true,
      },
      where: {
        familyId,
        id: {
          in: [...freezerStockDelta.keys()],
        },
      },
    });
    const currentQuantities = new Map(
      affectedFreezerItems.map((item) => [item.id, item.quantity]),
    );
    const stockValidation = validateFreezerStockDelta({
      currentQuantities,
      deltaByItemId: freezerStockDelta,
    });

    if (stockValidation.status === "INSUFFICIENT_STOCK") {
      logCollaborationWrite({
        action: "save-meal-plan-entries",
        domain: "meal-plan",
        entityType: "meal-plan-entry",
        familyId,
        mealPlanId: mealPlan.id,
        outcome: "VALIDATION_ERROR",
        userId,
      });

      return {
        formError: stockValidation.formError,
        status: "VALIDATION_ERROR" as const,
        values,
      };
    }
  }

  const responsibleUserIds = [
    ...new Set(values.map((entry) => entry.responsibleUserId).filter(Boolean)),
  ];

  if (responsibleUserIds.length > 0) {
    const members = await listFamilyMembers(familyId);
    const memberUserIds = new Set(members.map((member) => member.user.id));

    if (responsibleUserIds.some((userId) => !memberUserIds.has(userId))) {
      logCollaborationWrite({
        action: "save-meal-plan-entries",
        domain: "meal-plan",
        entityType: "meal-plan-entry",
        familyId,
        mealPlanId: mealPlan.id,
        outcome: "VALIDATION_ERROR",
        userId,
      });

      return {
        formError:
          "Minst en valgt ansvarlig er ikke medlem av familien.",
        status: "VALIDATION_ERROR" as const,
        values,
      };
    }
  }

  const submittedDates = values
    .map((entry) => parseDateOnly(entry.date)!)
    .filter(Boolean);
  const existingEntries = await db.mealPlanEntry.findMany({
    select: {
      date: true,
      updatedAt: true,
    },
    where: {
      date: {
        in: submittedDates,
      },
      mealPlanId: mealPlan.id,
      mealType: PLANNING_MEAL_TYPE,
    },
  });
  const existingEntryByDate = new Map(
    existingEntries.map((entry) => [formatDateOnly(entry.date), entry]),
  );
  const conflictingDates = values.flatMap((entry) => {
    const existingEntry = existingEntryByDate.get(entry.date);

    if (
      matchesExpectedUpdatedAt(
        entryVersions[entry.date],
        existingEntry?.updatedAt,
      )
    ) {
      return [];
    }

    return [entry.date];
  });

  if (conflictingDates.length > 0) {
    logCollaborationWrite({
      action: "save-meal-plan-entries",
      domain: "meal-plan",
      entityType: "meal-plan-entry",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "CONFLICT",
      userId,
    });

    return {
      conflictingDates,
      formError: COLLABORATION_CONFLICT_MESSAGE,
      status: "CONFLICT" as const,
      values,
    };
  }

  try {
    await db.$transaction(async (tx) => {
      for (const [freezerItemId, delta] of freezerStockDelta) {
        if (delta === 0) {
          continue;
        }

        const updated = await tx.familyFreezerItem.updateMany({
          data: {
            quantity: {
              increment: delta,
            },
          },
          where: {
            familyId,
            id: freezerItemId,
            ...(delta < 0
              ? {
                  quantity: {
                    gte: -delta,
                  },
                }
              : {}),
          },
        });

        if (updated.count === 0) {
          throw new Error("INSUFFICIENT_FREEZER_STOCK");
        }
      }

      for (let entry of values) {
        const date = parseDateOnly(entry.date);

        if (!date) {
          throw new Error(
            `Expected validated meal plan date for "${entry.date}".`,
          );
        }

        if (!entry.note && !entry.recipeId && !entry.freezerItemId) {
          await tx.mealPlanEntry.deleteMany({
            where: {
              date,
              mealPlanId: mealPlan.id,
              mealType: PLANNING_MEAL_TYPE,
            },
          });
          continue;
        }

        await tx.mealPlanEntry.upsert({
          create: {
            date,
            freezerItemId: entry.freezerItemId || null,
            mealPlanId: mealPlan.id,
            mealType: PLANNING_MEAL_TYPE,
            note: entry.note || null,
            recipeId: entry.recipeId || null,
            responsibleUserId: entry.responsibleUserId || null,
            ...buildActorUpdate(userId),
          },
          update: {
            freezerItemId: entry.freezerItemId || null,
            note: entry.note || null,
            recipeId: entry.recipeId || null,
            responsibleUserId: entry.responsibleUserId || null,
            ...buildActorUpdate(userId),
          },
          where: {
            mealPlanId_date_mealType: {
              date,
              mealPlanId: mealPlan.id,
              mealType: PLANNING_MEAL_TYPE,
            },
          },
        });
      }

      await tx.mealPlan.update({
        data: buildActorUpdate(userId),
        where: {
          id: mealPlan.id,
        },
      });
    });

    logCollaborationWrite({
      action: "save-meal-plan-entries",
      domain: "meal-plan",
      entityType: "meal-plan-entry",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "UPDATED",
      userId,
    });

    return {
      status: "UPDATED" as const,
    };
  } catch (error) {
    logCollaborationFailure({
      action: "save-meal-plan-entries",
      domain: "meal-plan",
      entityType: "meal-plan-entry",
      error,
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    throw error;
  }
}

async function updateMealPlanApprovalState(
  {
    entriesSnapshot,
    expectedMealPlanUpdatedAt,
    familyId,
    mealPlanId,
    userId,
  }: MealPlanApprovalInput,
  action: MealPlanApprovalAction,
) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const mealPlan = await db.mealPlan.findFirst({
    select: {
      entries: {
        select: {
          date: true,
          mealType: true,
          updatedAt: true,
        },
        where: {
          mealType: PLANNING_MEAL_TYPE,
        },
      },
      id: true,
      status: true,
      updatedAt: true,
    },
    where: {
      familyId,
      id: mealPlanId,
    },
  });

  if (!mealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  if (!isMealPlanStatusTransitionAllowed(mealPlan.status, action)) {
    return {
      formError: getMealPlanApprovalTransitionError(action, mealPlan.status),
      status: "INVALID_TRANSITION" as const,
    };
  }

  if (action === "APPROVE") {
    const currentEntriesSnapshot = buildMealPlanEntriesSnapshot(
      mealPlan.entries,
    );

    if (
      !matchesExpectedUpdatedAt(
        expectedMealPlanUpdatedAt,
        mealPlan.updatedAt,
      ) ||
      entriesSnapshot.trim() !== currentEntriesSnapshot
    ) {
      logCollaborationWrite({
        action: "approve-meal-plan",
        domain: "meal-plan",
        entityId: mealPlan.id,
        entityType: "meal-plan",
        familyId,
        mealPlanId: mealPlan.id,
        outcome: "CONFLICT",
        userId,
      });

      return {
        formError: COLLABORATION_APPROVAL_CONFLICT_MESSAGE,
        status: "CONFLICT" as const,
      };
    }
  }

  const nextStatus =
    action === "APPROVE" ? MealPlanStatus.APPROVED : MealPlanStatus.DRAFT;

  try {
    const updatedMealPlan = await db.$transaction(async (tx) => {
      const result = await tx.mealPlan.update({
        data:
          nextStatus === MealPlanStatus.APPROVED
            ? {
                approvedAt: new Date(),
                approvedByUserId: userId,
                status: MealPlanStatus.APPROVED,
                ...buildActorUpdate(userId),
              }
            : {
                approvedAt: null,
                approvedByUserId: null,
                status: MealPlanStatus.DRAFT,
                ...buildActorUpdate(userId),
              },
        select: mealPlanDetailSelect,
        where: {
          id: mealPlan.id,
        },
      });

      if (nextStatus === MealPlanStatus.APPROVED) {
        const closedAt = new Date();

        await tx.mealPlanShare.updateMany({
          data: {
            closedAt,
            status: "CLOSED",
          },
          where: {
            mealPlanId: mealPlan.id,
            status: "OPEN",
          },
        });
      }

      return result;
    });

    logCollaborationWrite({
      action: action === "APPROVE" ? "approve-meal-plan" : "reopen-meal-plan",
      domain: "meal-plan",
      entityId: mealPlan.id,
      entityType: "meal-plan",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "UPDATED",
      userId,
    });

    return {
      mealPlan: updatedMealPlan,
      status:
        action === "APPROVE" ? ("APPROVED" as const) : ("REOPENED" as const),
    };
  } catch (error) {
    logCollaborationFailure({
      action: action === "APPROVE" ? "approve-meal-plan" : "reopen-meal-plan",
      domain: "meal-plan",
      entityId: mealPlan.id,
      entityType: "meal-plan",
      error,
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    throw error;
  }
}

function validateMealPlanInput({
  endDate,
  startDate,
  title,
}: Pick<
  MealPlanMutationInput,
  "endDate" | "startDate" | "title"
>): MealPlanValidationResult {
  const trimmedTitle = title.trim();
  const rangeValidation = validateMealPlanRange(startDate, endDate);
  const values = {
    endDate: rangeValidation.values.endDate,
    startDate: rangeValidation.values.startDate,
    title: trimmedTitle,
  };

  if (!trimmedTitle) {
    return {
      fieldErrors: {
        ...(rangeValidation.ok ? {} : rangeValidation.fieldErrors),
        title: "Skriv inn et navn for ukeplanen.",
      },
      ok: false,
      values,
    };
  }

  if (!rangeValidation.ok) {
    return {
      fieldErrors: rangeValidation.fieldErrors,
      ok: false,
      values,
    };
  }

  return {
    ok: true,
    values,
  };
}

function isMealPlanStatusTransitionAllowed(
  status: MealPlanStatus,
  action: MealPlanApprovalAction,
) {
  if (action === "APPROVE") {
    return status === MealPlanStatus.DRAFT;
  }

  return status === MealPlanStatus.APPROVED;
}

function getMealPlanApprovalTransitionError(
  action: MealPlanApprovalAction,
  currentStatus: MealPlanStatus,
) {
  if (action === "APPROVE") {
    if (currentStatus === MealPlanStatus.APPROVED) {
      return "Ukeplanen er allerede godkjent.";
    }

    return "Ukeplanen kan ikke godkjennes fra gjeldende status.";
  }

  if (currentStatus === MealPlanStatus.DRAFT) {
    return "Ukeplanen er allerede et utkast.";
  }

  return "Ukeplanen kan ikke gjenåpnes fra gjeldende status.";
}

function shuffleRecipeIds(recipeIds: string[]) {
  const shuffled = [...recipeIds];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    const currentValue = shuffled[index]!;
    shuffled[index] = shuffled[swapIndex]!;
    shuffled[swapIndex] = currentValue;
  }

  return shuffled;
}

function assignRecipesToDates({
  eligibleRecipeIds,
  targetDateCount,
  usedRecipeIdsInPlan,
}: {
  eligibleRecipeIds: string[];
  targetDateCount: number;
  usedRecipeIdsInPlan: Set<string>;
}) {
  const uniquePool = shuffleRecipeIds(
    eligibleRecipeIds.filter((recipeId) => !usedRecipeIdsInPlan.has(recipeId)),
  );
  const assignments: string[] = [];
  let hadRepeats = false;

  for (let index = 0; index < targetDateCount; index += 1) {
    if (index < uniquePool.length) {
      const recipeId = uniquePool[index]!;
      assignments.push(recipeId);
      usedRecipeIdsInPlan.add(recipeId);
      continue;
    }

    hadRepeats = true;
    const repeatPool = shuffleRecipeIds(eligibleRecipeIds);
    assignments.push(repeatPool[index % repeatPool.length]!);
  }

  return {
    assignments,
    hadRepeats,
  };
}

function normalizeMealPlanEntryValues(
  entry: MealPlanEntryValues,
): MealPlanEntryValues {
  return {
    date: entry.date.trim(),
    freezerItemId: entry.freezerItemId.trim(),
    note: entry.note.trim(),
    recipeId: entry.recipeId.trim(),
    responsibleUserId: entry.responsibleUserId.trim(),
  };
}

function validateMealPlanEntries(
  entries: MealPlanEntryValues[],
  startDate: Date,
  endDate: Date,
) {
  const visibleDateSet = new Set(getMealPlanDateRange(startDate, endDate));

  if (entries.length !== visibleDateSet.size) {
    return "Noen dager mangler i ukeplanen. Last siden på nytt og prøv igjen.";
  }

  const seenDates = new Set<string>();

  for (let entry of entries) {
    if (!entry.date) {
      return "Fant en ugyldig dag i ukeplanen.";
    }

    const parsedDate = parseDateOnly(entry.date);

    if (!parsedDate) {
      return "Fant en ugyldig dag i ukeplanen.";
    }

    if (!visibleDateSet.has(entry.date)) {
      return "En av dagene ligger utenfor den aktive perioden.";
    }

    if (seenDates.has(entry.date)) {
      return "Hver dag kan bare sendes inn en gang per lagring.";
    }

    seenDates.add(entry.date);
  }

  return null;
}

function getDinnerAnalyticsStartDate(
  timeframe: DinnerAnalyticsTimeframe,
  now: Date,
) {
  switch (timeframe) {
    case "30d":
      return addUtcDays(now, -30);
    case "90d":
      return addUtcDays(now, -90);
    case "all":
      return null;
  }
}

export function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return parsedDate;
}

function differenceInUtcDays(startDate: Date, endDate: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.round(
    (endDate.getTime() - startDate.getTime()) / millisecondsPerDay,
  );
}

function addUtcDays(date: Date, amount: number) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + amount,
    ),
  );
}

function clampShoppingDateToRange(
  activeShoppingDate: Date | null,
  startDate: Date,
  endDate: Date,
) {
  if (!activeShoppingDate) {
    return null;
  }

  if (activeShoppingDate.getTime() < startDate.getTime()) {
    return startDate;
  }

  if (activeShoppingDate.getTime() > endDate.getTime()) {
    return startDate;
  }

  return activeShoppingDate;
}
