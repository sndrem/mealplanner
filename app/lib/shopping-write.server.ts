import { ShoppingItemSource } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";

export interface ManualShoppingItemValues {
  buyOnDate: string;
  categoryId: string;
  name: string;
  note: string;
  preferredStoreId: string;
  quantity: string;
}

export interface ManualShoppingItemFieldErrors {
  buyOnDate?: string;
  categoryId?: string;
  name?: string;
  preferredStoreId?: string;
}

export interface GeneratedShoppingItemOverrideValues {
  note: string;
  postponedUntilDate: string;
  preferredStoreId: string;
}

export interface GeneratedShoppingItemOverrideFieldErrors {
  postponedUntilDate?: string;
  preferredStoreId?: string;
}

export async function createManualShoppingItem({
  familyId,
  mealPlanId,
  userId,
  values,
}: {
  familyId: string;
  mealPlanId: string;
  userId: string;
  values: ManualShoppingItemValues;
}) {
  const mealPlan = await getScopedMealPlan({
    familyId,
    mealPlanId,
    userId,
  });

  if (!mealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  const validation = await validateManualShoppingItemValues({
    familyId,
    mealPlan,
    values,
  });

  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  await db.manualShoppingItem.create({
    data: {
      buyOnDate: validation.buyOnDate,
      categoryId: validation.values.categoryId,
      mealPlanId: mealPlan.id,
      name: validation.values.name,
      note: validation.values.note || null,
      preferredStoreId: validation.preferredStoreId,
      quantity: validation.values.quantity || null,
    },
  });

  return {
    status: "CREATED" as const,
  };
}

export async function updateManualShoppingItem({
  familyId,
  manualItemId,
  mealPlanId,
  userId,
  values,
}: {
  familyId: string;
  manualItemId: string;
  mealPlanId: string;
  userId: string;
  values: ManualShoppingItemValues;
}) {
  const mealPlan = await getScopedMealPlan({
    familyId,
    mealPlanId,
    userId,
  });

  if (!mealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  const existingItem = await db.manualShoppingItem.findFirst({
    select: {
      id: true,
    },
    where: {
      id: manualItemId,
      mealPlanId: mealPlan.id,
    },
  });

  if (!existingItem) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  const validation = await validateManualShoppingItemValues({
    familyId,
    mealPlan,
    values,
  });

  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  await db.manualShoppingItem.update({
    data: {
      buyOnDate: validation.buyOnDate,
      categoryId: validation.values.categoryId,
      name: validation.values.name,
      note: validation.values.note || null,
      preferredStoreId: validation.preferredStoreId,
      quantity: validation.values.quantity || null,
    },
    where: {
      id: existingItem.id,
    },
  });

  return {
    status: "UPDATED" as const,
  };
}

export async function deleteManualShoppingItem({
  familyId,
  manualItemId,
  mealPlanId,
  userId,
}: {
  familyId: string;
  manualItemId: string;
  mealPlanId: string;
  userId: string;
}) {
  const mealPlan = await getScopedMealPlan({
    familyId,
    mealPlanId,
    userId,
  });

  if (!mealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  const existingItem = await db.manualShoppingItem.findFirst({
    select: {
      id: true,
    },
    where: {
      id: manualItemId,
      mealPlanId: mealPlan.id,
    },
  });

  if (!existingItem) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.shoppingItemOverride.deleteMany({
      where: {
        mealPlanId: mealPlan.id,
        sourceKey: existingItem.id,
        sourceType: ShoppingItemSource.MANUAL,
      },
    });
    await tx.manualShoppingItem.delete({
      where: {
        id: existingItem.id,
      },
    });
  });

  return {
    status: "DELETED" as const,
  };
}

export async function toggleShoppingItemChecked({
  checked,
  familyId,
  mealPlanId,
  sourceKey,
  sourceType,
  userId,
}: {
  checked: boolean;
  familyId: string;
  mealPlanId: string;
  sourceKey: string;
  sourceType: ShoppingItemSource;
  userId: string;
}) {
  const mealPlan = await getScopedMealPlan({
    familyId,
    mealPlanId,
    userId,
  });

  if (!mealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  if (sourceType === ShoppingItemSource.MANUAL) {
    const existingItem = await db.manualShoppingItem.findFirst({
      select: {
        id: true,
      },
      where: {
        id: sourceKey,
        mealPlanId: mealPlan.id,
      },
    });

    if (!existingItem) {
      return {
        status: "NOT_FOUND" as const,
      };
    }
  }

  const existingOverride = await db.shoppingItemOverride.findUnique({
    where: {
      mealPlanId_sourceType_sourceKey: {
        mealPlanId: mealPlan.id,
        sourceKey,
        sourceType,
      },
    },
  });

  if (!checked) {
    if (!existingOverride) {
      return {
        status: "UPDATED" as const,
      };
    }

    if (shouldDeleteOverrideAfterUnchecked(existingOverride)) {
      await db.shoppingItemOverride.delete({
        where: {
          id: existingOverride.id,
        },
      });
    } else {
      await db.shoppingItemOverride.update({
        data: {
          checked: false,
        },
        where: {
          id: existingOverride.id,
        },
      });
    }

    return {
      status: "UPDATED" as const,
    };
  }

  await db.shoppingItemOverride.upsert({
    create: {
      checked: true,
      mealPlanId: mealPlan.id,
      sourceKey,
      sourceType,
    },
    update: {
      checked: true,
    },
    where: {
      mealPlanId_sourceType_sourceKey: {
        mealPlanId: mealPlan.id,
        sourceKey,
        sourceType,
      },
    },
  });

  return {
    status: "UPDATED" as const,
  };
}

export async function updateGeneratedShoppingItemOverride({
  familyId,
  mealPlanId,
  sourceKey,
  userId,
  values,
}: {
  familyId: string;
  mealPlanId: string;
  sourceKey: string;
  userId: string;
  values: GeneratedShoppingItemOverrideValues;
}) {
  const mealPlan = await getScopedMealPlan({
    familyId,
    mealPlanId,
    userId,
  });

  if (!mealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  const validation = await validateGeneratedShoppingItemOverrideValues({
    familyId,
    mealPlan,
    values,
  });

  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  const existingOverride = await db.shoppingItemOverride.findUnique({
    where: {
      mealPlanId_sourceType_sourceKey: {
        mealPlanId: mealPlan.id,
        sourceKey,
        sourceType: ShoppingItemSource.GENERATED,
      },
    },
  });
  const nextData: {
    checked: boolean;
    note: string | null;
    postponedUntilDate: Date | null;
    preferredStoreId: string | null;
  } = {
    checked: existingOverride?.checked ?? false,
    note: validation.values.note || null,
    postponedUntilDate: validation.postponedUntilDate ?? null,
    preferredStoreId: validation.preferredStoreId,
  };

  if (isOverrideEmpty(nextData)) {
    if (existingOverride) {
      await db.shoppingItemOverride.delete({
        where: {
          id: existingOverride.id,
        },
      });
    }

    return {
      status: "UPDATED" as const,
    };
  }

  await db.shoppingItemOverride.upsert({
    create: {
      ...nextData,
      mealPlanId: mealPlan.id,
      sourceKey,
      sourceType: ShoppingItemSource.GENERATED,
    },
    update: nextData,
    where: {
      mealPlanId_sourceType_sourceKey: {
        mealPlanId: mealPlan.id,
        sourceKey,
        sourceType: ShoppingItemSource.GENERATED,
      },
    },
  });

  return {
    status: "UPDATED" as const,
  };
}

async function getScopedMealPlan({
  familyId,
  mealPlanId,
  userId,
}: {
  familyId: string;
  mealPlanId: string;
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  return db.mealPlan.findFirst({
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
}

async function validateManualShoppingItemValues({
  familyId,
  mealPlan,
  values,
}: {
  familyId: string;
  mealPlan: {
    endDate: Date;
    id: string;
    startDate: Date;
  };
  values: ManualShoppingItemValues;
}) {
  const normalizedValues = normalizeManualShoppingItemValues(values);
  const fieldErrors: ManualShoppingItemFieldErrors = {};

  if (!normalizedValues.name) {
    fieldErrors.name = "Skriv inn et varenavn.";
  }

  if (!normalizedValues.categoryId) {
    fieldErrors.categoryId = "Velg en kategori.";
  }

  const buyOnDateValidation = validateOptionalDateInRange(
    normalizedValues.buyOnDate,
    mealPlan.startDate,
    mealPlan.endDate,
    "Velg en gyldig handledato.",
  );

  if (!buyOnDateValidation.ok) {
    fieldErrors.buyOnDate = buyOnDateValidation.fieldError;
  }

  if (fieldErrors.name || fieldErrors.categoryId || fieldErrors.buyOnDate) {
    return {
      fieldErrors,
      ok: false as const,
      values: normalizedValues,
    };
  }

  const [matchingCategory, matchingStore] = await Promise.all([
    db.ingredientCategory.findUnique({
      select: {
        id: true,
      },
      where: {
        id: normalizedValues.categoryId,
      },
    }),
    resolveScopedStoreId(normalizedValues.preferredStoreId, familyId),
  ]);

  if (!matchingCategory) {
    fieldErrors.categoryId = "Velg en gyldig kategori.";
  }

  if (normalizedValues.preferredStoreId && !matchingStore) {
    fieldErrors.preferredStoreId = "Velg en gyldig butikk for familien.";
  }

  if (fieldErrors.categoryId || fieldErrors.preferredStoreId) {
    return {
      fieldErrors,
      ok: false as const,
      values: normalizedValues,
    };
  }

  return {
    buyOnDate: buyOnDateValidation.date,
    ok: true as const,
    preferredStoreId: matchingStore,
    values: normalizedValues,
  };
}

async function validateGeneratedShoppingItemOverrideValues({
  familyId,
  mealPlan,
  values,
}: {
  familyId: string;
  mealPlan: {
    endDate: Date;
    id: string;
    startDate: Date;
  };
  values: GeneratedShoppingItemOverrideValues;
}) {
  const normalizedValues = normalizeGeneratedShoppingItemOverrideValues(values);
  const fieldErrors: GeneratedShoppingItemOverrideFieldErrors = {};
  const postponedDateValidation = validateOptionalDateInRange(
    normalizedValues.postponedUntilDate,
    mealPlan.startDate,
    mealPlan.endDate,
    "Velg en gyldig dato innenfor ukeplanen.",
  );

  if (!postponedDateValidation.ok) {
    fieldErrors.postponedUntilDate = postponedDateValidation.fieldError;
  }

  if (fieldErrors.postponedUntilDate) {
    return {
      fieldErrors,
      ok: false as const,
      values: normalizedValues,
    };
  }

  const preferredStoreId = await resolveScopedStoreId(normalizedValues.preferredStoreId, familyId);

  if (normalizedValues.preferredStoreId && !preferredStoreId) {
    return {
      fieldErrors: {
        preferredStoreId: "Velg en gyldig butikk for familien.",
      },
      ok: false as const,
      values: normalizedValues,
    };
  }

  return {
    ok: true as const,
    postponedUntilDate: postponedDateValidation.date,
    preferredStoreId,
    values: normalizedValues,
  };
}

function normalizeManualShoppingItemValues(values: ManualShoppingItemValues): ManualShoppingItemValues {
  return {
    buyOnDate: values.buyOnDate.trim(),
    categoryId: values.categoryId.trim(),
    name: values.name.trim(),
    note: values.note.trim(),
    preferredStoreId: values.preferredStoreId.trim(),
    quantity: values.quantity.trim(),
  };
}

function normalizeGeneratedShoppingItemOverrideValues(
  values: GeneratedShoppingItemOverrideValues,
): GeneratedShoppingItemOverrideValues {
  return {
    note: values.note.trim(),
    postponedUntilDate: values.postponedUntilDate.trim(),
    preferredStoreId: values.preferredStoreId.trim(),
  };
}

async function resolveScopedStoreId(preferredStoreId: string, familyId: string) {
  if (!preferredStoreId) {
    return null;
  }

  const store = await db.store.findFirst({
    select: {
      id: true,
    },
    where: {
      id: preferredStoreId,
      OR: [{ familyId: null }, { familyId }],
    },
  });

  return store?.id ?? null;
}

function validateOptionalDateInRange(
  value: string,
  startDate: Date,
  endDate: Date,
  invalidMessage: string,
) {
  if (!value) {
    return {
      date: null,
      ok: true as const,
    };
  }

  const parsedDate = parseDateOnly(value);

  if (!parsedDate) {
    return {
      fieldError: invalidMessage,
      ok: false as const,
    };
  }

  if (parsedDate.getTime() < startDate.getTime() || parsedDate.getTime() > endDate.getTime()) {
    return {
      fieldError: "Datoen ma ligge innenfor ukeplanens aktive periode.",
      ok: false as const,
    };
  }

  return {
    date: parsedDate,
    ok: true as const,
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

function shouldDeleteOverrideAfterUnchecked(existingOverride: {
  note: string | null;
  postponedUntilDate: Date | null;
  preferredStoreId: string | null;
  sourceType: ShoppingItemSource;
}) {
  if (existingOverride.sourceType === ShoppingItemSource.MANUAL) {
    return true;
  }

  return !existingOverride.note && !existingOverride.postponedUntilDate && !existingOverride.preferredStoreId;
}

function isOverrideEmpty(values: {
  checked: boolean;
  note: string | null;
  postponedUntilDate: Date | null;
  preferredStoreId: string | null;
}) {
  return !values.checked && !values.note && !values.postponedUntilDate && !values.preferredStoreId;
}
