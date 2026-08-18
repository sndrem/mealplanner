import {
  buildActorUpdate,
  COLLABORATION_CONFLICT_MESSAGE,
  matchesExpectedUpdatedAt,
} from "./collaboration.server";
import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import { normalizeIngredientCanonicalName } from "./ingredient-normalize";
import { recordShoppingCheckEvent } from "./shopping-check-history.server";
import {
  buildRecentManualItemFromProjectedItem,
  projectCreatedFamilyShoppingItem,
} from "./shopping.server";
import { upsertFamilyShoppingCatalogItemFromQuickAdd } from "./shopping-catalog-write.server";
import {
  resolveQuickAddManualShoppingItemValues,
  type QuickAddManualShoppingItemInput,
} from "./shopping-write.server";
import { logCollaborationFailure, logCollaborationWrite } from "./write-observability.server";

export interface FamilyShoppingItemValues {
  categoryId: string;
  name: string;
  note: string;
  preferredStoreId: string;
  quantity: string;
}

export interface FamilyShoppingItemFieldErrors {
  categoryId?: string;
  name?: string;
  preferredStoreId?: string;
}

const QUICK_ADD_DEFAULT_QUANTITY = "1";

export function parseFamilyShoppingItemValues(
  formData: FormData,
): FamilyShoppingItemValues {
  return {
    categoryId: String(formData.get("categoryId") ?? ""),
    name: String(formData.get("name") ?? ""),
    note: String(formData.get("note") ?? ""),
    preferredStoreId: String(formData.get("preferredStoreId") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
  };
}

export function parseQuickAddFamilyShoppingItemInput(formData: FormData) {
  return {
    catalogItemId: String(formData.get("catalogItemId") ?? ""),
    ingredientId: String(formData.get("ingredientId") ?? ""),
    name: String(formData.get("name") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    recentNameNormalized: String(formData.get("recentNameNormalized") ?? ""),
  } satisfies QuickAddManualShoppingItemInput;
}

export async function createQuickFamilyShoppingItem({
  familyId,
  input,
  userId,
}: {
  familyId: string;
  input: QuickAddManualShoppingItemInput;
  userId: string;
}) {
  const resolvedValues = await resolveQuickAddFamilyShoppingItemValues({
    familyId,
    input,
  });

  if (!resolvedValues.ok) {
    return {
      fieldErrors: resolvedValues.fieldErrors,
      formError: resolvedValues.formError,
      status: "VALIDATION_ERROR" as const,
      values: resolvedValues.values,
    };
  }

  const createResult = await createFamilyShoppingItem({
    familyId,
    userId,
    values: resolvedValues.values,
  });

  if (createResult.status !== "CREATED") {
    return createResult;
  }

  const item = await projectCreatedFamilyShoppingItem({
    familyId,
    familyItemId: createResult.familyItemId,
  });

  if (!item) {
    throw new Error("Fant ikke den nylig opprettede familiens handlelinje.");
  }

  await upsertFamilyShoppingCatalogItemFromQuickAdd({
    familyId,
    ingredientId: input.ingredientId,
    item,
  });

  return {
    item,
    recentManualItem: buildRecentManualItemFromProjectedItem(item),
    status: "CREATED" as const,
  };
}

export async function createFamilyShoppingItem({
  familyId,
  userId,
  values,
}: {
  familyId: string;
  userId: string;
  values: FamilyShoppingItemValues;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const validation = await validateFamilyShoppingItemValues({
    familyId,
    values,
  });

  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  try {
    const created = await db.familyShoppingItem.create({
      data: {
        categoryId: validation.values.categoryId,
        familyId,
        name: validation.values.name,
        note: validation.values.note || null,
        preferredStoreId: validation.preferredStoreId,
        quantity: validation.values.quantity || null,
        ...buildActorUpdate(userId),
      },
    });

    logCollaborationWrite({
      action: "create-family-shopping-item",
      domain: "shopping",
      entityType: "family-shopping-item",
      familyId,
      outcome: "CREATED",
      userId,
    });

    return {
      familyItemId: created.id,
      status: "CREATED" as const,
    };
  } catch (error) {
    logCollaborationFailure({
      action: "create-family-shopping-item",
      domain: "shopping",
      entityType: "family-shopping-item",
      error,
      familyId,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    throw error;
  }
}

export async function updateFamilyShoppingItem({
  expectedUpdatedAt,
  familyId,
  familyItemId,
  userId,
  values,
}: {
  expectedUpdatedAt: string;
  familyId: string;
  familyItemId: string;
  userId: string;
  values: FamilyShoppingItemValues;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const existingItem = await db.familyShoppingItem.findFirst({
    select: {
      id: true,
      updatedAt: true,
    },
    where: {
      familyId,
      id: familyItemId,
    },
  });

  if (!existingItem) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  if (!matchesExpectedUpdatedAt(expectedUpdatedAt, existingItem.updatedAt)) {
    return buildFamilyShoppingConflictResult({
      action: "update-family-shopping-item",
      entityId: existingItem.id,
      familyId,
      userId,
    });
  }

  const validation = await validateFamilyShoppingItemValues({
    familyId,
    values,
  });

  if (!validation.ok) {
    logCollaborationWrite({
      action: "update-family-shopping-item",
      domain: "shopping",
      entityId: existingItem.id,
      entityType: "family-shopping-item",
      familyId,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  try {
    const updateResult = await db.familyShoppingItem.updateMany({
      data: {
        categoryId: validation.values.categoryId,
        name: validation.values.name,
        note: validation.values.note || null,
        preferredStoreId: validation.preferredStoreId,
        quantity: validation.values.quantity || null,
        ...buildActorUpdate(userId),
      },
      where: {
        familyId,
        id: existingItem.id,
        updatedAt: existingItem.updatedAt,
      },
    });

    if (updateResult.count === 0) {
      return buildFamilyShoppingConflictResult({
        action: "update-family-shopping-item",
        entityId: existingItem.id,
        familyId,
        userId,
      });
    }

    logCollaborationWrite({
      action: "update-family-shopping-item",
      domain: "shopping",
      entityId: existingItem.id,
      entityType: "family-shopping-item",
      familyId,
      outcome: "UPDATED",
      userId,
    });

    return {
      status: "UPDATED" as const,
    };
  } catch (error) {
    logCollaborationFailure({
      action: "update-family-shopping-item",
      domain: "shopping",
      entityId: existingItem.id,
      entityType: "family-shopping-item",
      error,
      familyId,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    throw error;
  }
}

export async function deleteFamilyShoppingItem({
  expectedUpdatedAt,
  familyId,
  familyItemId,
  userId,
}: {
  expectedUpdatedAt: string;
  familyId: string;
  familyItemId: string;
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const existingItem = await db.familyShoppingItem.findFirst({
    select: {
      id: true,
      updatedAt: true,
    },
    where: {
      familyId,
      id: familyItemId,
    },
  });

  if (!existingItem) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  if (!matchesExpectedUpdatedAt(expectedUpdatedAt, existingItem.updatedAt)) {
    return buildFamilyShoppingConflictResult({
      action: "delete-family-shopping-item",
      entityId: existingItem.id,
      familyId,
      userId,
    });
  }

  const deleteResult = await db.familyShoppingItem.deleteMany({
    where: {
      familyId,
      id: existingItem.id,
      updatedAt: existingItem.updatedAt,
    },
  });

  if (deleteResult.count === 0) {
    return buildFamilyShoppingConflictResult({
      action: "delete-family-shopping-item",
      entityId: existingItem.id,
      familyId,
      userId,
    });
  }

  logCollaborationWrite({
    action: "delete-family-shopping-item",
    domain: "shopping",
    entityId: existingItem.id,
    entityType: "family-shopping-item",
    familyId,
    outcome: "DELETED",
    userId,
  });

  return {
    status: "DELETED" as const,
  };
}

export async function toggleFamilyShoppingItemChecked({
  checked,
  expectedUpdatedAt,
  familyId,
  familyItemId,
  userId,
}: {
  checked: boolean;
  expectedUpdatedAt: string;
  familyId: string;
  familyItemId: string;
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const existingItem = await db.familyShoppingItem.findFirst({
    select: {
      checked: true,
      id: true,
      name: true,
      updatedAt: true,
    },
    where: {
      familyId,
      id: familyItemId,
    },
  });

  if (!existingItem) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  if (!matchesExpectedUpdatedAt(expectedUpdatedAt, existingItem.updatedAt)) {
    return buildFamilyShoppingConflictResult({
      action: "toggle-family-shopping-item-checked",
      entityId: existingItem.id,
      familyId,
      userId,
    });
  }

  const outcome = await db.$transaction(async (tx) => {
    const updateResult = await tx.familyShoppingItem.updateMany({
      data: {
        checked,
        ...buildActorUpdate(userId),
      },
      where: {
        familyId,
        id: existingItem.id,
        updatedAt: existingItem.updatedAt,
      },
    });

    if (updateResult.count === 0) {
      return {
        status: "CONFLICT" as const,
      };
    }

    await recordShoppingCheckEvent(tx, {
      actorUserId: userId,
      checked,
      familyId,
      itemName: existingItem.name,
      mealPlanId: null,
      sourceType: null,
      targetKey: existingItem.id,
      targetType: "FAMILY_ITEM",
    });

    return {
      status: "UPDATED" as const,
    };
  });

  if (outcome.status === "CONFLICT") {
    return buildFamilyShoppingConflictResult({
      action: "toggle-family-shopping-item-checked",
      entityId: existingItem.id,
      familyId,
      userId,
    });
  }

  logCollaborationWrite({
    action: "toggle-family-shopping-item-checked",
    domain: "shopping",
    entityId: existingItem.id,
    entityType: "family-shopping-item",
    familyId,
    outcome: "UPDATED",
    userId,
  });

  return {
    status: "UPDATED" as const,
  };
}

export async function updateFamilyShoppingItemQuantity({
  expectedUpdatedAt,
  familyId,
  familyItemId,
  quantity,
  userId,
}: {
  expectedUpdatedAt: string;
  familyId: string;
  familyItemId: string;
  quantity: string;
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const existingItem = await db.familyShoppingItem.findFirst({
    select: {
      id: true,
      updatedAt: true,
    },
    where: {
      familyId,
      id: familyItemId,
    },
  });

  if (!existingItem) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  if (!matchesExpectedUpdatedAt(expectedUpdatedAt, existingItem.updatedAt)) {
    return buildFamilyShoppingConflictResult({
      action: "update-family-shopping-item-quantity",
      entityId: existingItem.id,
      familyId,
      userId,
    });
  }

  const updateResult = await db.familyShoppingItem.updateMany({
    data: {
      quantity: quantity.trim() || null,
      ...buildActorUpdate(userId),
    },
    where: {
      familyId,
      id: existingItem.id,
      updatedAt: existingItem.updatedAt,
    },
  });

  if (updateResult.count === 0) {
    return buildFamilyShoppingConflictResult({
      action: "update-family-shopping-item-quantity",
      entityId: existingItem.id,
      familyId,
      userId,
    });
  }

  logCollaborationWrite({
    action: "update-family-shopping-item-quantity",
    domain: "shopping",
    entityId: existingItem.id,
    entityType: "family-shopping-item",
    familyId,
    outcome: "UPDATED",
    userId,
  });

  return {
    status: "UPDATED" as const,
  };
}

async function resolveQuickAddFamilyShoppingItemValues({
  familyId,
  input,
}: {
  familyId: string;
  input: QuickAddManualShoppingItemInput;
}) {
  const manualResolved = await resolveQuickAddManualShoppingItemValues({
    familyId,
    input,
  });

  if (manualResolved.ok) {
    return {
      ok: true as const,
      values: toFamilyShoppingItemValues(manualResolved.values),
    };
  }

  const recentNameNormalized = input.recentNameNormalized?.trim().toLowerCase();

  if (recentNameNormalized) {
    const recentItem = await findLatestFamilyShoppingItemForFamilyByNormalizedName({
      familyId,
      nameNormalized: recentNameNormalized,
    });

    if (recentItem) {
      return {
        ok: true as const,
        values: buildQuickAddFamilyShoppingItemValues({
          categoryId: recentItem.categoryId,
          name: recentItem.name.trim(),
          quantity: recentItem.quantity?.trim() || QUICK_ADD_DEFAULT_QUANTITY,
        }),
      };
    }
  }

  return {
    fieldErrors: manualResolved.fieldErrors,
    formError: manualResolved.formError,
    ok: false as const,
    values: toFamilyShoppingItemValues(manualResolved.values),
  };
}

async function findLatestFamilyShoppingItemForFamilyByNormalizedName({
  familyId,
  nameNormalized,
}: {
  familyId: string;
  nameNormalized: string;
}) {
  const rows = await db.familyShoppingItem.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      categoryId: true,
      name: true,
      quantity: true,
    },
    take: 50,
    where: {
      familyId,
    },
  });

  return (
    rows.find(
      (row) => normalizeIngredientCanonicalName(row.name) === nameNormalized,
    ) ?? null
  );
}

function toFamilyShoppingItemValues(values: {
  buyOnDate: string;
  categoryId: string;
  name: string;
  note: string;
  preferredStoreId: string;
  quantity: string;
}): FamilyShoppingItemValues {
  return {
    categoryId: values.categoryId,
    name: values.name,
    note: values.note,
    preferredStoreId: values.preferredStoreId,
    quantity: values.quantity,
  };
}

function buildQuickAddFamilyShoppingItemValues({
  categoryId,
  name,
  quantity = QUICK_ADD_DEFAULT_QUANTITY,
}: {
  categoryId: string;
  name: string;
  quantity?: string;
}): FamilyShoppingItemValues {
  return {
    categoryId,
    name,
    note: "",
    preferredStoreId: "",
    quantity,
  };
}

async function validateFamilyShoppingItemValues({
  familyId,
  values,
}: {
  familyId: string;
  values: FamilyShoppingItemValues;
}) {
  const normalizedValues = normalizeFamilyShoppingItemValues(values);
  const fieldErrors: FamilyShoppingItemFieldErrors = {};

  if (!normalizedValues.name) {
    fieldErrors.name = "Skriv inn et varenavn.";
  }

  if (!normalizedValues.categoryId) {
    fieldErrors.categoryId = "Velg en kategori.";
  }

  if (fieldErrors.name || fieldErrors.categoryId) {
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
    ok: true as const,
    preferredStoreId: matchingStore,
    values: normalizedValues,
  };
}

function normalizeFamilyShoppingItemValues(
  values: FamilyShoppingItemValues,
): FamilyShoppingItemValues {
  return {
    categoryId: values.categoryId.trim(),
    name: values.name.trim(),
    note: values.note.trim(),
    preferredStoreId: values.preferredStoreId.trim(),
    quantity: values.quantity.trim(),
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

function buildFamilyShoppingConflictResult({
  action,
  entityId,
  familyId,
  userId,
}: {
  action: string;
  entityId: string;
  familyId: string;
  userId: string;
}) {
  logCollaborationWrite({
    action,
    domain: "shopping",
    entityId,
    entityType: "family-shopping-item",
    familyId,
    outcome: "CONFLICT",
    userId,
  });

  return {
    formError: COLLABORATION_CONFLICT_MESSAGE,
    status: "CONFLICT" as const,
  };
}
