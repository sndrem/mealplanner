import type { Prisma, ShoppingItemSource } from "@prisma/client";

import { db } from "./db.server";

export const SHOPPING_CHECK_HISTORY_LIMIT = 100;

const FALLBACK_ITEM_NAME = "Ukjent vare";

type DbClient = Prisma.TransactionClient | typeof db;

type ShoppingCheckEventTarget = "FAMILY_ITEM" | "MEAL_PLAN_ITEM";

export type ShoppingHistoryEntry = {
  actorDisplayName: string;
  checked: boolean;
  id: string;
  itemName: string;
  occurredAt: string;
  sourceKey: string;
  sourceType: "FAMILY" | "GENERATED" | "MANUAL";
};

export async function recordShoppingCheckEvent(
  client: DbClient,
  {
    actorUserId,
    checked,
    familyId,
    itemName,
    mealPlanId,
    sourceType,
    targetKey,
    targetType,
  }: {
    actorUserId: string;
    checked: boolean;
    familyId: string;
    itemName: string;
    mealPlanId?: string | null;
    sourceType?: ShoppingItemSource | null;
    targetKey: string;
    targetType: ShoppingCheckEventTarget;
  },
) {
  const trimmedName = itemName.trim();

  await client.shoppingItemCheckEvent.create({
    data: {
      actorUserId,
      checked,
      familyId,
      itemName: trimmedName.length > 0 ? trimmedName : FALLBACK_ITEM_NAME,
      mealPlanId: mealPlanId ?? null,
      sourceType: sourceType ?? null,
      targetKey,
      targetType,
    },
  });
}

export async function resolveMealPlanShoppingItemName(
  client: DbClient,
  {
    mealPlanId,
    sourceKey,
    sourceType,
  }: {
    mealPlanId: string;
    sourceKey: string;
    sourceType: ShoppingItemSource;
  },
) {
  if (sourceType === "MANUAL") {
    const manualItem = await client.manualShoppingItem.findFirst({
      select: {
        name: true,
      },
      where: {
        id: sourceKey,
        mealPlanId,
      },
    });

    return manualItem?.name.trim() || FALLBACK_ITEM_NAME;
  }

  const firstOccurrenceKey = sourceKey.split("|")[0] ?? "";
  const separatorIndex = firstOccurrenceKey.indexOf(":");

  if (separatorIndex === -1) {
    return FALLBACK_ITEM_NAME;
  }

  const recipeIngredientId = firstOccurrenceKey.slice(separatorIndex + 1);

  if (!recipeIngredientId) {
    return FALLBACK_ITEM_NAME;
  }

  const recipeIngredient = await client.recipeIngredient.findUnique({
    select: {
      displayName: true,
    },
    where: {
      id: recipeIngredientId,
    },
  });

  return recipeIngredient?.displayName.trim() || FALLBACK_ITEM_NAME;
}

export async function listShoppingCheckHistoryForStoreMode({
  familyId,
  mealPlanIds,
}: {
  familyId: string;
  mealPlanIds: string[];
}): Promise<ShoppingHistoryEntry[]> {
  const uniqueMealPlanIds = [...new Set(mealPlanIds.filter(Boolean))];

  const events = await db.shoppingItemCheckEvent.findMany({
    include: {
      actorUser: {
        select: {
          displayName: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: SHOPPING_CHECK_HISTORY_LIMIT,
    where: {
      familyId,
      OR: [
        ...(uniqueMealPlanIds.length > 0
          ? [
              {
                mealPlanId: {
                  in: uniqueMealPlanIds,
                },
              },
            ]
          : []),
        {
          targetType: "FAMILY_ITEM",
        },
      ],
    },
  });

  return events.map((event) => ({
    actorDisplayName: event.actorUser.displayName,
    checked: event.checked,
    id: event.id,
    itemName: event.itemName,
    occurredAt: event.createdAt.toISOString(),
    sourceKey: event.targetKey,
    sourceType: mapHistorySourceType(event.targetType, event.sourceType),
  }));
}

function mapHistorySourceType(
  targetType: ShoppingCheckEventTarget,
  sourceType: ShoppingItemSource | null,
): ShoppingHistoryEntry["sourceType"] {
  if (targetType === "FAMILY_ITEM") {
    return "FAMILY";
  }

  if (sourceType === "MANUAL") {
    return "MANUAL";
  }

  return "GENERATED";
}
