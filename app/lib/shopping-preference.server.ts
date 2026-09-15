import { db } from "./db.server";
import type { FamilyShoppingListModeValue } from "./meal-plan-for-date.server";
import {
  DEFAULT_SHOPPING_GROCERY_GROUPING,
  type ShoppingGroceryGroupingValue,
} from "./shopping-grocery-grouping";

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

export async function getShoppingGroceryGrouping({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}): Promise<ShoppingGroceryGroupingValue> {
  const preference = await db.userFamilyShoppingPreference.findUnique({
    select: {
      groceryGrouping: true,
    },
    where: {
      userId_familyId: {
        familyId,
        userId,
      },
    },
  });

  return preference?.groceryGrouping ?? DEFAULT_SHOPPING_GROCERY_GROUPING;
}
