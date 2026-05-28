import { db } from "./db.server";
import type { FamilyShoppingListModeValue } from "./meal-plan-for-date.server";

export async function getFamilyShoppingListMode({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}): Promise<FamilyShoppingListModeValue> {
  const preference = await db.userFamilyShoppingPreference.findUnique({
    select: {
      listMode: true,
    },
    where: {
      userId_familyId: {
        familyId,
        userId,
      },
    },
  });

  return preference?.listMode ?? "GLOBAL";
}
