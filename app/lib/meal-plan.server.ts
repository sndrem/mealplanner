import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";

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

interface DeleteMealPlanInput {
  familyId: string;
  mealPlanId: string;
  userId: string;
}

type GetMealPlanInput = DeleteMealPlanInput;

interface MealPlanListInput {
  familyId: string;
  userId: string;
}

export function formatDateOnly(date: Date) {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
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
