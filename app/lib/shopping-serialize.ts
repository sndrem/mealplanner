import { ShoppingItemSource } from "@prisma/client";

import { formatDateOnly } from "./meal-plan-dates";
import type { ProjectedShoppingItem } from "./shopping.server";

export function serializeProjectedShoppingItem(item: ProjectedShoppingItem) {
  if (item.sourceType === "FAMILY") {
    return item;
  }

  if (item.sourceType === ShoppingItemSource.GENERATED) {
    return {
      ...item,
      firstDate: formatDateOnly(item.firstDate),
      lastDate: formatDateOnly(item.lastDate),
      occurrences: item.occurrences.map((occurrence) => ({
        ...occurrence,
        date: formatDateOnly(occurrence.date),
      })),
      postponedUntilDate: item.postponedUntilDate
        ? formatDateOnly(item.postponedUntilDate)
        : null,
    };
  }

  return {
    ...item,
    buyOnDate: item.buyOnDate ? formatDateOnly(item.buyOnDate) : null,
  };
}

export type SerializedProjectedShoppingItem = ReturnType<
  typeof serializeProjectedShoppingItem
>;
