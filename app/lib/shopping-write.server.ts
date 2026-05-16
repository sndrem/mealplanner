import { ShoppingItemSource } from "@prisma/client";

import {
  buildActorUpdate,
  COLLABORATION_CONFLICT_MESSAGE,
  matchesExpectedUpdatedAt,
} from "./collaboration.server";
import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import {
  getStockIngredientsForMealPlan,
  loadShoppingMealPlan,
} from "./shopping.server";
import { getFamilyStockMatchSet } from "./stock.server";
import { logCollaborationFailure, logCollaborationWrite } from "./write-observability.server";

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

export interface ActiveShoppingDateFieldErrors {
  activeShoppingDate?: string;
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

  try {
    await db.manualShoppingItem.create({
      data: {
        buyOnDate: validation.buyOnDate,
        categoryId: validation.values.categoryId,
        mealPlanId: mealPlan.id,
        name: validation.values.name,
        note: validation.values.note || null,
        preferredStoreId: validation.preferredStoreId,
        quantity: validation.values.quantity || null,
        ...buildActorUpdate(userId),
      },
    });

    logCollaborationWrite({
      action: "create-manual-shopping-item",
      domain: "shopping",
      entityType: "manual-shopping-item",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "CREATED",
      userId,
    });

    return {
      status: "CREATED" as const,
    };
  } catch (error) {
    logCollaborationFailure({
      action: "create-manual-shopping-item",
      domain: "shopping",
      entityType: "manual-shopping-item",
      error,
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    throw error;
  }
}

export async function updateManualShoppingItem({
  expectedUpdatedAt,
  familyId,
  manualItemId,
  mealPlanId,
  userId,
  values,
}: {
  expectedUpdatedAt: string;
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
      updatedAt: true,
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

  if (!matchesExpectedUpdatedAt(expectedUpdatedAt, existingItem.updatedAt)) {
    return buildShoppingConflictResult({
      action: "update-manual-shopping-item",
      entityId: existingItem.id,
      entityType: "manual-shopping-item",
      familyId,
      mealPlanId: mealPlan.id,
      userId,
    });
  }

  const validation = await validateManualShoppingItemValues({
    familyId,
    mealPlan,
    values,
  });

  if (!validation.ok) {
    logCollaborationWrite({
      action: "update-manual-shopping-item",
      domain: "shopping",
      entityId: existingItem.id,
      entityType: "manual-shopping-item",
      familyId,
      mealPlanId: mealPlan.id,
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
    const updateResult = await db.manualShoppingItem.updateMany({
      data: {
        buyOnDate: validation.buyOnDate,
        categoryId: validation.values.categoryId,
        name: validation.values.name,
        note: validation.values.note || null,
        preferredStoreId: validation.preferredStoreId,
        quantity: validation.values.quantity || null,
        ...buildActorUpdate(userId),
      },
      where: {
        id: existingItem.id,
        updatedAt: existingItem.updatedAt,
      },
    });

    if (updateResult.count === 0) {
      return buildShoppingConflictResult({
        action: "update-manual-shopping-item",
        entityId: existingItem.id,
        entityType: "manual-shopping-item",
        familyId,
        mealPlanId: mealPlan.id,
        userId,
      });
    }

    logCollaborationWrite({
      action: "update-manual-shopping-item",
      domain: "shopping",
      entityId: existingItem.id,
      entityType: "manual-shopping-item",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "UPDATED",
      userId,
    });

    return {
      status: "UPDATED" as const,
    };
  } catch (error) {
    logCollaborationFailure({
      action: "update-manual-shopping-item",
      domain: "shopping",
      entityId: existingItem.id,
      entityType: "manual-shopping-item",
      error,
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    throw error;
  }
}

export async function deleteManualShoppingItem({
  expectedUpdatedAt,
  familyId,
  manualItemId,
  mealPlanId,
  userId,
}: {
  expectedUpdatedAt: string;
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
      updatedAt: true,
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

  if (!matchesExpectedUpdatedAt(expectedUpdatedAt, existingItem.updatedAt)) {
    return buildShoppingConflictResult({
      action: "delete-manual-shopping-item",
      entityId: existingItem.id,
      entityType: "manual-shopping-item",
      familyId,
      mealPlanId: mealPlan.id,
      userId,
    });
  }

  try {
    const deleteResult = await db.manualShoppingItem.deleteMany({
      where: {
        id: existingItem.id,
        updatedAt: existingItem.updatedAt,
      },
    });

    if (deleteResult.count === 0) {
      return buildShoppingConflictResult({
        action: "delete-manual-shopping-item",
        entityId: existingItem.id,
        entityType: "manual-shopping-item",
        familyId,
        mealPlanId: mealPlan.id,
        userId,
      });
    }

    await db.shoppingItemOverride.deleteMany({
      where: {
        mealPlanId: mealPlan.id,
        sourceKey: existingItem.id,
        sourceType: ShoppingItemSource.MANUAL,
      },
    });

    logCollaborationWrite({
      action: "delete-manual-shopping-item",
      domain: "shopping",
      entityId: existingItem.id,
      entityType: "manual-shopping-item",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "DELETED",
      userId,
    });

    return {
      status: "DELETED" as const,
    };
  } catch (error) {
    logCollaborationFailure({
      action: "delete-manual-shopping-item",
      domain: "shopping",
      entityId: existingItem.id,
      entityType: "manual-shopping-item",
      error,
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    throw error;
  }
}

export async function toggleShoppingItemChecked({
  checked,
  expectedUpdatedAt,
  familyId,
  mealPlanId,
  sourceKey,
  sourceType,
  userId,
}: {
  checked: boolean;
  expectedUpdatedAt: string;
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
    select: {
      checked: true,
      id: true,
      includeDespiteStock: true,
      note: true,
      postponedUntilDate: true,
      preferredStoreId: true,
      sourceType: true,
      updatedAt: true,
    },
    where: {
      mealPlanId_sourceType_sourceKey: {
        mealPlanId: mealPlan.id,
        sourceKey,
        sourceType,
      },
    },
  });

  if (!matchesExpectedUpdatedAt(expectedUpdatedAt, existingOverride?.updatedAt)) {
    return buildShoppingConflictResult({
      action: "toggle-shopping-item-checked",
      entityId: existingOverride?.id ?? sourceKey,
      entityType: "shopping-item-override",
      familyId,
      mealPlanId: mealPlan.id,
      userId,
    });
  }

  try {
    if (!checked) {
      if (!existingOverride) {
        return {
          status: "UPDATED" as const,
        };
      }

      if (shouldDeleteOverrideAfterUnchecked(existingOverride)) {
        const deleteResult = await db.shoppingItemOverride.deleteMany({
          where: {
            id: existingOverride.id,
            updatedAt: existingOverride.updatedAt,
          },
        });

        if (deleteResult.count === 0) {
          return buildShoppingConflictResult({
            action: "toggle-shopping-item-checked",
            entityId: existingOverride.id,
            entityType: "shopping-item-override",
            familyId,
            mealPlanId: mealPlan.id,
            userId,
          });
        }
      } else {
        const updateResult = await db.shoppingItemOverride.updateMany({
          data: {
            checked: false,
            ...buildActorUpdate(userId),
          },
          where: {
            id: existingOverride.id,
            updatedAt: existingOverride.updatedAt,
          },
        });

        if (updateResult.count === 0) {
          return buildShoppingConflictResult({
            action: "toggle-shopping-item-checked",
            entityId: existingOverride.id,
            entityType: "shopping-item-override",
            familyId,
            mealPlanId: mealPlan.id,
            userId,
          });
        }
      }

      logCollaborationWrite({
        action: "toggle-shopping-item-checked",
        domain: "shopping",
        entityId: existingOverride.id,
        entityType: "shopping-item-override",
        familyId,
        mealPlanId: mealPlan.id,
        outcome: "UPDATED",
        userId,
      });

      return {
        status: "UPDATED" as const,
      };
    }

    if (existingOverride) {
      const updateResult = await db.shoppingItemOverride.updateMany({
        data: {
          checked: true,
          ...buildActorUpdate(userId),
        },
        where: {
          id: existingOverride.id,
          updatedAt: existingOverride.updatedAt,
        },
      });

      if (updateResult.count === 0) {
        return buildShoppingConflictResult({
          action: "toggle-shopping-item-checked",
          entityId: existingOverride.id,
          entityType: "shopping-item-override",
          familyId,
          mealPlanId: mealPlan.id,
          userId,
        });
      }
    } else {
      await db.shoppingItemOverride.create({
        data: {
          checked: true,
          mealPlanId: mealPlan.id,
          sourceKey,
          sourceType,
          ...buildActorUpdate(userId),
        },
      });
    }

    logCollaborationWrite({
      action: "toggle-shopping-item-checked",
      domain: "shopping",
      entityId: existingOverride?.id ?? sourceKey,
      entityType: "shopping-item-override",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "UPDATED",
      userId,
    });

    return {
      status: "UPDATED" as const,
    };
  } catch (error) {
    logCollaborationFailure({
      action: "toggle-shopping-item-checked",
      domain: "shopping",
      entityId: existingOverride?.id ?? sourceKey,
      entityType: "shopping-item-override",
      error,
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    throw error;
  }
}

export async function optInStockShoppingItems({
  familyId,
  mealPlanId,
  sourceKeys,
  userId,
}: {
  familyId: string;
  mealPlanId: string;
  sourceKeys: string[];
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const uniqueSourceKeys = [...new Set(sourceKeys.map((key) => key.trim()).filter(Boolean))];

  if (uniqueSourceKeys.length === 0) {
    return {
      status: "VALIDATION_ERROR" as const,
      formError: "Velg minst en basisvare som skal legges til i handlelisten.",
    };
  }

  const mealPlan = await loadShoppingMealPlan({
    familyId,
    mealPlanId,
  });

  if (!mealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  const stockMatchSet = await getFamilyStockMatchSet(familyId);
  const includeDespiteStockKeys = new Set(
    mealPlan.shoppingOverrides
      .filter(
        (override) =>
          override.sourceType === ShoppingItemSource.GENERATED &&
          override.includeDespiteStock,
      )
      .map((override) => override.sourceKey),
  );
  const stockIngredients = getStockIngredientsForMealPlan({
    includeDespiteStockKeys,
    mealPlan,
    stockMatchSet,
  });
  const allowedSourceKeys = new Set(
    stockIngredients.map((ingredient) => ingredient.sourceKey),
  );
  const invalidSourceKeys = uniqueSourceKeys.filter(
    (sourceKey) => !allowedSourceKeys.has(sourceKey),
  );

  if (invalidSourceKeys.length > 0) {
    return {
      status: "VALIDATION_ERROR" as const,
      formError: "En eller flere basisvarer finnes ikke i ukeplanen.",
    };
  }

  try {
    for (const sourceKey of uniqueSourceKeys) {
      const existingOverride = await db.shoppingItemOverride.findUnique({
        select: {
          checked: true,
          id: true,
          note: true,
          postponedUntilDate: true,
          preferredStoreId: true,
        },
        where: {
          mealPlanId_sourceType_sourceKey: {
            mealPlanId: mealPlan.id,
            sourceKey,
            sourceType: ShoppingItemSource.GENERATED,
          },
        },
      });

      await db.shoppingItemOverride.upsert({
        create: {
          checked: existingOverride?.checked ?? false,
          includeDespiteStock: true,
          mealPlanId: mealPlan.id,
          note: existingOverride?.note ?? null,
          postponedUntilDate: existingOverride?.postponedUntilDate ?? null,
          preferredStoreId: existingOverride?.preferredStoreId ?? null,
          sourceKey,
          sourceType: ShoppingItemSource.GENERATED,
          ...buildActorUpdate(userId),
        },
        update: {
          includeDespiteStock: true,
          ...buildActorUpdate(userId),
        },
        where: {
          mealPlanId_sourceType_sourceKey: {
            mealPlanId: mealPlan.id,
            sourceKey,
            sourceType: ShoppingItemSource.GENERATED,
          },
        },
      });
    }

    logCollaborationWrite({
      action: "opt-in-stock-shopping-items",
      domain: "shopping",
      entityId: mealPlan.id,
      entityType: "meal-plan",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "UPDATED",
      userId,
    });

    return {
      status: "UPDATED" as const,
    };
  } catch (error) {
    logCollaborationFailure({
      action: "opt-in-stock-shopping-items",
      domain: "shopping",
      entityId: mealPlan.id,
      entityType: "meal-plan",
      error,
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    throw error;
  }
}

export async function updateGeneratedShoppingItemOverride({
  expectedUpdatedAt,
  familyId,
  mealPlanId,
  sourceKey,
  userId,
  values,
}: {
  expectedUpdatedAt: string;
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
    select: {
      checked: true,
      id: true,
      includeDespiteStock: true,
      note: true,
      postponedUntilDate: true,
      preferredStoreId: true,
      updatedAt: true,
    },
    where: {
      mealPlanId_sourceType_sourceKey: {
        mealPlanId: mealPlan.id,
        sourceKey,
        sourceType: ShoppingItemSource.GENERATED,
      },
    },
  });

  if (!matchesExpectedUpdatedAt(expectedUpdatedAt, existingOverride?.updatedAt)) {
    return buildShoppingConflictResult({
      action: "update-generated-shopping-item",
      entityId: existingOverride?.id ?? sourceKey,
      entityType: "shopping-item-override",
      familyId,
      mealPlanId: mealPlan.id,
      userId,
    });
  }

  const nextData: {
    checked: boolean;
    includeDespiteStock: boolean;
    note: string | null;
    postponedUntilDate: Date | null;
    preferredStoreId: string | null;
  } = {
    checked: existingOverride?.checked ?? false,
    includeDespiteStock: existingOverride?.includeDespiteStock ?? false,
    note: validation.values.note || null,
    postponedUntilDate: validation.postponedUntilDate ?? null,
    preferredStoreId: validation.preferredStoreId,
  };

  try {
    if (isOverrideEmpty(nextData)) {
      if (existingOverride) {
        const deleteResult = await db.shoppingItemOverride.deleteMany({
          where: {
            id: existingOverride.id,
            updatedAt: existingOverride.updatedAt,
          },
        });

        if (deleteResult.count === 0) {
          return buildShoppingConflictResult({
            action: "update-generated-shopping-item",
            entityId: existingOverride.id,
            entityType: "shopping-item-override",
            familyId,
            mealPlanId: mealPlan.id,
            userId,
          });
        }
      }

      logCollaborationWrite({
        action: "update-generated-shopping-item",
        domain: "shopping",
        entityId: existingOverride?.id ?? sourceKey,
        entityType: "shopping-item-override",
        familyId,
        mealPlanId: mealPlan.id,
        outcome: "UPDATED",
        userId,
      });

      return {
        status: "UPDATED" as const,
      };
    }

    if (existingOverride) {
      const updateResult = await db.shoppingItemOverride.updateMany({
        data: {
          ...nextData,
          ...buildActorUpdate(userId),
        },
        where: {
          id: existingOverride.id,
          updatedAt: existingOverride.updatedAt,
        },
      });

      if (updateResult.count === 0) {
        return buildShoppingConflictResult({
          action: "update-generated-shopping-item",
          entityId: existingOverride.id,
          entityType: "shopping-item-override",
          familyId,
          mealPlanId: mealPlan.id,
          userId,
        });
      }
    } else {
      await db.shoppingItemOverride.create({
        data: {
          ...nextData,
          mealPlanId: mealPlan.id,
          sourceKey,
          sourceType: ShoppingItemSource.GENERATED,
          ...buildActorUpdate(userId),
        },
      });
    }

    logCollaborationWrite({
      action: "update-generated-shopping-item",
      domain: "shopping",
      entityId: existingOverride?.id ?? sourceKey,
      entityType: "shopping-item-override",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "UPDATED",
      userId,
    });

    return {
      status: "UPDATED" as const,
    };
  } catch (error) {
    logCollaborationFailure({
      action: "update-generated-shopping-item",
      domain: "shopping",
      entityId: existingOverride?.id ?? sourceKey,
      entityType: "shopping-item-override",
      error,
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    throw error;
  }
}

export async function updateActiveShoppingDate({
  activeShoppingDate,
  expectedMealPlanUpdatedAt,
  familyId,
  mealPlanId,
  userId,
}: {
  activeShoppingDate: string;
  expectedMealPlanUpdatedAt: string;
  familyId: string;
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

  if (!matchesExpectedUpdatedAt(expectedMealPlanUpdatedAt, mealPlan.updatedAt)) {
    return buildShoppingConflictResult({
      action: "update-active-shopping-date",
      entityId: mealPlan.id,
      entityType: "meal-plan",
      familyId,
      mealPlanId: mealPlan.id,
      userId,
    });
  }

  const normalizedDate = activeShoppingDate.trim();
  const validation = validateOptionalDateInRange(
    normalizedDate,
    mealPlan.startDate,
    mealPlan.endDate,
    "Velg en gyldig handledato.",
  );

  if (!validation.ok) {
    return {
      fieldErrors: {
        activeShoppingDate: validation.fieldError,
      },
      status: "VALIDATION_ERROR" as const,
      values: {
        activeShoppingDate: normalizedDate,
      },
    };
  }

  try {
    const updateResult = await db.mealPlan.updateMany({
      data: {
        activeShoppingDate: validation.date ?? mealPlan.startDate,
        ...buildActorUpdate(userId),
      },
      where: {
        id: mealPlan.id,
        updatedAt: mealPlan.updatedAt,
      },
    });

    if (updateResult.count === 0) {
      return buildShoppingConflictResult({
        action: "update-active-shopping-date",
        entityId: mealPlan.id,
        entityType: "meal-plan",
        familyId,
        mealPlanId: mealPlan.id,
        userId,
      });
    }

    logCollaborationWrite({
      action: "update-active-shopping-date",
      domain: "shopping",
      entityId: mealPlan.id,
      entityType: "meal-plan",
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "UPDATED",
      userId,
    });

    return {
      status: "UPDATED" as const,
    };
  } catch (error) {
    logCollaborationFailure({
      action: "update-active-shopping-date",
      domain: "shopping",
      entityId: mealPlan.id,
      entityType: "meal-plan",
      error,
      familyId,
      mealPlanId: mealPlan.id,
      outcome: "VALIDATION_ERROR",
      userId,
    });

    throw error;
  }
}

function buildShoppingConflictResult({
  action,
  entityId,
  entityType,
  familyId,
  mealPlanId,
  userId,
}: {
  action: string;
  entityId: string;
  entityType: string;
  familyId: string;
  mealPlanId: string;
  userId: string;
}) {
  logCollaborationWrite({
    action,
    domain: "shopping",
    entityId,
    entityType,
    familyId,
    mealPlanId,
    outcome: "CONFLICT",
    userId,
  });

  return {
    formError: COLLABORATION_CONFLICT_MESSAGE,
    status: "CONFLICT" as const,
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
      updatedAt: true,
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
  includeDespiteStock: boolean;
  note: string | null;
  postponedUntilDate: Date | null;
  preferredStoreId: string | null;
  sourceType: ShoppingItemSource;
}) {
  if (existingOverride.sourceType === ShoppingItemSource.MANUAL) {
    return true;
  }

  return (
    !existingOverride.includeDespiteStock &&
    !existingOverride.note &&
    !existingOverride.postponedUntilDate &&
    !existingOverride.preferredStoreId
  );
}

function isOverrideEmpty(values: {
  checked: boolean;
  includeDespiteStock: boolean;
  note: string | null;
  postponedUntilDate: Date | null;
  preferredStoreId: string | null;
}) {
  return (
    !values.checked &&
    !values.includeDespiteStock &&
    !values.note &&
    !values.postponedUntilDate &&
    !values.preferredStoreId
  );
}
