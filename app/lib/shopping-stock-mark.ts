export const MARK_GENERATED_SHOPPING_ITEM_AS_STOCK_INTENT =
  "mark-generated-shopping-item-as-stock";

export const MARK_FAMILY_SHOPPING_ITEM_AS_STOCK_INTENT =
  "mark-family-shopping-item-as-stock";

export interface GeneratedStockMarkTarget {
  mealPlanId: string;
  sourceKey: string;
}

export function parseGeneratedStockMarkTargets(
  formData: FormData,
): GeneratedStockMarkTarget[] {
  const mealPlanIds = formData
    .getAll("memberMealPlanId")
    .map((value) => String(value).trim());
  const sourceKeys = formData
    .getAll("memberSourceKey")
    .map((value) => String(value).trim());

  if (mealPlanIds.length === 0 || mealPlanIds.length !== sourceKeys.length) {
    return [];
  }

  const targets: GeneratedStockMarkTarget[] = [];

  for (let index = 0; index < mealPlanIds.length; index += 1) {
    const mealPlanId = mealPlanIds[index] ?? "";
    const sourceKey = sourceKeys[index] ?? "";

    if (!mealPlanId || !sourceKey) {
      return [];
    }

    targets.push({
      mealPlanId,
      sourceKey,
    });
  }

  return targets;
}

export function getGeneratedStockMarkTargets(item: {
  groupingMembers?: Array<{
    mealPlanId: string | null;
    sourceKey: string;
  }>;
  mealPlanId?: string | null;
  sourceKey: string;
}): GeneratedStockMarkTarget[] {
  const groupedMembers = item.groupingMembers ?? [];

  if (groupedMembers.length > 1) {
    const targets = groupedMembers.flatMap((member) =>
      member.mealPlanId
        ? [
            {
              mealPlanId: member.mealPlanId,
              sourceKey: member.sourceKey,
            },
          ]
        : [],
    );

    return targets.length === groupedMembers.length ? targets : [];
  }

  if (!item.mealPlanId) {
    return [];
  }

  return [
    {
      mealPlanId: item.mealPlanId,
      sourceKey: item.sourceKey,
    },
  ];
}
