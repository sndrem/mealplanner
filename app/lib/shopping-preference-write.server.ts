import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import {
  FAMILY_SHOPPING_LIST_MODES,
  type FamilyShoppingListModeValue,
} from "./meal-plan-for-date.server";

const validListModes = new Set<FamilyShoppingListModeValue>(
  FAMILY_SHOPPING_LIST_MODES,
);

export function parseFamilyShoppingListMode(
  value: FormDataEntryValue | null,
): FamilyShoppingListModeValue | null {
  const normalized = String(value ?? "").trim();

  if (validListModes.has(normalized as FamilyShoppingListModeValue)) {
    return normalized as FamilyShoppingListModeValue;
  }

  return null;
}

export async function updateFamilyShoppingListMode({
  familyId,
  listMode,
  userId,
}: {
  familyId: string;
  listMode: FamilyShoppingListModeValue;
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  if (!validListModes.has(listMode)) {
    return {
      formError: "Ugyldig visningsmodus for handlelisten.",
      status: "VALIDATION_ERROR" as const,
    };
  }

  await db.userFamilyShoppingPreference.upsert({
    create: {
      familyId,
      listMode,
      userId,
    },
    update: {
      listMode,
    },
    where: {
      userId_familyId: {
        familyId,
        userId,
      },
    },
  });

  return {
    status: "UPDATED" as const,
  };
}
