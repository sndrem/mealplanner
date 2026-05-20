import type { MealType } from "@prisma/client";

export const COLLABORATION_CONFLICT_MESSAGE =
  "Noen andre har oppdatert dette. Last siden på nytt og prøv igjen.";

export const COLLABORATION_APPROVAL_CONFLICT_MESSAGE =
  "Ukeplanen ble endret etter at siden ble lastet. Last siden på nytt før du godkjenner.";

export function buildActorUpdate(userId: string) {
  return {
    updatedByUserId: userId,
  };
}

export function serializeUpdatedAt(date: Date) {
  return date.toISOString();
}

export function matchesExpectedUpdatedAt(
  expectedUpdatedAt: string | undefined | null,
  actualUpdatedAt: Date | null | undefined,
) {
  const normalizedExpected = expectedUpdatedAt?.trim() ?? "";

  if (!actualUpdatedAt) {
    return normalizedExpected === "";
  }

  if (normalizedExpected === "") {
    return false;
  }

  return actualUpdatedAt.toISOString() === normalizedExpected;
}

export function buildMealPlanEntriesSnapshot(
  entries: Array<{
    date: Date;
    mealType: MealType;
    updatedAt: Date;
  }>,
) {
  return entries
    .slice()
    .sort((left, right) => {
      const dateComparison = left.date.getTime() - right.date.getTime();

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return left.mealType.localeCompare(right.mealType);
    })
    .map((entry) => `${entry.date.toISOString()}:${entry.mealType}:${entry.updatedAt.toISOString()}`)
    .join("|");
}
