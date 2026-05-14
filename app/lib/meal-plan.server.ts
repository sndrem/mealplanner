import { MealPlanStatus, MealType, Prisma, RecipeScope } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyAdmin, requireFamilyMembership } from "./family.server";

const MEAL_PLAN_MAX_SPAN_DAYS = 7;
const MEAL_PLAN_MAX_DAY_OFFSET = MEAL_PLAN_MAX_SPAN_DAYS - 1;

const mealPlanSummarySelect = {
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

const mealPlanEntrySelect = Prisma.validator<Prisma.MealPlanEntrySelect>()({
  createdAt: true,
  date: true,
  id: true,
  locked: true,
  mealType: true,
  note: true,
  recipe: {
    select: recipeOptionSelect,
  },
  recipeId: true,
  updatedAt: true,
});

const mealPlanPlanningDetailSelect = Prisma.validator<Prisma.MealPlanSelect>()({
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
  note: string;
  recipeId: string;
}

interface SaveMealPlanEntriesInput {
  entries: MealPlanEntryValues[];
  familyId: string;
  mealPlanId: string;
  userId: string;
}

interface DeleteMealPlanInput {
  familyId: string;
  mealPlanId: string;
  userId: string;
}

type MealPlanApprovalInput = DeleteMealPlanInput;

type GetMealPlanInput = DeleteMealPlanInput;

interface MealPlanListInput {
  familyId: string;
  userId: string;
}

type MealPlanPlanningInput = GetMealPlanInput;

type MealPlanApprovalAction = "APPROVE" | "REOPEN";

export function formatDateOnly(date: Date) {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

export function getMealPlanDateRange(startDate: Date, endDate: Date) {
  let currentDate = new Date(startDate.getTime());
  let dates: string[] = [];

  while (currentDate.getTime() <= endDate.getTime()) {
    dates.push(formatDateOnly(currentDate));
    currentDate = addUtcDays(currentDate, 1);
  }

  return dates;
}

export function validateMealPlanRange(startDate: string, endDate: string): MealPlanValidationResult {
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
        endDate: "Datointervallet kan være maks 7 dager.",
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

export async function listMealPlansForFamily({ familyId, userId }: MealPlanListInput) {
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

export async function getMealPlanForFamily({ familyId, mealPlanId, userId }: GetMealPlanInput) {
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
      OR: [{ scope: RecipeScope.GLOBAL }, { familyId, scope: RecipeScope.FAMILY }],
    },
  });

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
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

  const mealPlan = await db.mealPlan.create({
    data: {
      endDate: parseDateOnly(validation.values.endDate)!,
      familyId: input.familyId,
      startDate: parseDateOnly(validation.values.startDate)!,
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

      const dayOffset = differenceInUtcDays(sourceMealPlan.startDate, entry.date);
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

export async function updateMealPlan(input: MealPlanMutationInput & { mealPlanId: string }) {
  await requireFamilyMembership({
    familyId: input.familyId,
    userId: input.userId,
  });

  const existingMealPlan = await db.mealPlan.findFirst({
    select: {
      id: true,
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

  const validation = validateMealPlanInput(input);

  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  const mealPlan = await db.mealPlan.update({
    data: {
      endDate: parseDateOnly(validation.values.endDate)!,
      startDate: parseDateOnly(validation.values.startDate)!,
      title: validation.values.title,
    },
    select: mealPlanDetailSelect,
    where: {
      id: existingMealPlan.id,
    },
  });

  return {
    mealPlan,
    status: "UPDATED" as const,
  };
}

export async function deleteMealPlan({ familyId, mealPlanId, userId }: DeleteMealPlanInput) {
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

export async function saveMealPlanEntries({
  entries,
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
  const validationError = validateMealPlanEntries(values, mealPlan.startDate, mealPlan.endDate);

  if (validationError) {
    return {
      formError: validationError,
      status: "VALIDATION_ERROR" as const,
      values,
    };
  }

  const recipeIds = [...new Set(values.map((entry) => entry.recipeId).filter(Boolean))];

  if (recipeIds.length > 0) {
    const recipes = await db.recipe.findMany({
      select: {
        id: true,
      },
      where: {
        id: {
          in: recipeIds,
        },
        OR: [{ scope: RecipeScope.GLOBAL }, { familyId, scope: RecipeScope.FAMILY }],
      },
    });

    if (recipes.length !== recipeIds.length) {
      return {
        formError: "Minst en valgt oppskrift er ikke tilgjengelig for familien.",
        status: "VALIDATION_ERROR" as const,
        values,
      };
    }
  }

  await db.$transaction(async (tx) => {
    for (let entry of values) {
      const date = parseDateOnly(entry.date);

      if (!date) {
        throw new Error(`Expected validated meal plan date for "${entry.date}".`);
      }

      if (!entry.note && !entry.recipeId) {
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
          mealPlanId: mealPlan.id,
          mealType: PLANNING_MEAL_TYPE,
          note: entry.note || null,
          recipeId: entry.recipeId || null,
        },
        update: {
          note: entry.note || null,
          recipeId: entry.recipeId || null,
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
  });

  return {
    status: "UPDATED" as const,
  };
}

async function updateMealPlanApprovalState(
  { familyId, mealPlanId, userId }: MealPlanApprovalInput,
  action: MealPlanApprovalAction,
) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const mealPlan = await db.mealPlan.findFirst({
    select: {
      id: true,
      status: true,
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

  const nextStatus = action === "APPROVE" ? MealPlanStatus.APPROVED : MealPlanStatus.DRAFT;
  const updatedMealPlan = await db.mealPlan.update({
    data:
      nextStatus === MealPlanStatus.APPROVED
        ? {
            approvedAt: new Date(),
            approvedByUserId: userId,
            status: MealPlanStatus.APPROVED,
          }
        : {
            approvedAt: null,
            approvedByUserId: null,
            status: MealPlanStatus.DRAFT,
          },
    select: mealPlanDetailSelect,
    where: {
      id: mealPlan.id,
    },
  });

  return {
    mealPlan: updatedMealPlan,
    status: action === "APPROVE" ? ("APPROVED" as const) : ("REOPENED" as const),
  };
}

function validateMealPlanInput({
  endDate,
  startDate,
  title,
}: Pick<MealPlanMutationInput, "endDate" | "startDate" | "title">): MealPlanValidationResult {
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

function isMealPlanStatusTransitionAllowed(status: MealPlanStatus, action: MealPlanApprovalAction) {
  if (action === "APPROVE") {
    return status === MealPlanStatus.DRAFT;
  }

  return status === MealPlanStatus.APPROVED;
}

function getMealPlanApprovalTransitionError(action: MealPlanApprovalAction, currentStatus: MealPlanStatus) {
  if (action === "APPROVE") {
    if (currentStatus === MealPlanStatus.APPROVED) {
      return "Ukeplanen er allerede godkjent.";
    }

    return "Ukeplanen kan ikke godkjennes fra gjeldende status.";
  }

  if (currentStatus === MealPlanStatus.DRAFT) {
    return "Ukeplanen er allerede et utkast.";
  }

  return "Ukeplanen kan ikke gjenapnes fra gjeldende status.";
}

function normalizeMealPlanEntryValues(entry: MealPlanEntryValues): MealPlanEntryValues {
  return {
    date: entry.date.trim(),
    note: entry.note.trim(),
    recipeId: entry.recipeId.trim(),
  };
}

function validateMealPlanEntries(entries: MealPlanEntryValues[], startDate: Date, endDate: Date) {
  const visibleDateSet = new Set(getMealPlanDateRange(startDate, endDate));

  if (entries.length !== visibleDateSet.size) {
    return "Noen dager mangler i ukeplanen. Last siden pa nytt og prov igjen.";
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

function parseDateOnly(value: string) {
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

  return Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
}

function addUtcDays(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + amount));
}
