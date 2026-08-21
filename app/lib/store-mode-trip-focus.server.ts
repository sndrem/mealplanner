import { db } from "./db.server";
import type { StoreModeTripFocusValue } from "./meal-plan-for-date.server";

export async function getStoreModeTripFocus({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}): Promise<StoreModeTripFocusValue> {
  const preference = await db.userStorePreference.findUnique({
    select: {
      storeModeTripFocus: true,
    },
    where: {
      userId_familyId: {
        familyId,
        userId,
      },
    },
  });

  return preference?.storeModeTripFocus ?? "CURRENT";
}
