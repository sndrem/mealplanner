import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import {
  STORE_MODE_TRIP_FOCUS_VALUES,
  type StoreModeTripFocusValue,
} from "./meal-plan-for-date.server";

const validTripFocusValues = new Set<StoreModeTripFocusValue>(
  STORE_MODE_TRIP_FOCUS_VALUES,
);

export function parseStoreModeTripFocus(
  value: FormDataEntryValue | null,
): StoreModeTripFocusValue | null {
  const normalized = String(value ?? "").trim();

  if (validTripFocusValues.has(normalized as StoreModeTripFocusValue)) {
    return normalized as StoreModeTripFocusValue;
  }

  return null;
}

export async function updateStoreModeTripFocus({
  familyId,
  tripFocus,
  userId,
}: {
  familyId: string;
  tripFocus: StoreModeTripFocusValue;
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  if (!validTripFocusValues.has(tripFocus)) {
    return {
      formError: "Ugyldig fokus for butikkmodus.",
      status: "VALIDATION_ERROR" as const,
    };
  }

  await db.userStorePreference.upsert({
    create: {
      familyId,
      storeModeTripFocus: tripFocus,
      userId,
    },
    update: {
      storeModeTripFocus: tripFocus,
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
