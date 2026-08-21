import { z } from "zod";

import type { SharedShoppingSnapshot } from "./shopping-section-groups";

const sharedShoppingSnapshotItemSchema = z.object({
  categoryId: z.string().min(1),
  categoryName: z.string().min(1),
  id: z.string().min(1),
  name: z.string().min(1),
  note: z.string().nullable(),
  quantityLabel: z.string().nullable(),
});

const sharedShoppingSnapshotStoreSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sections: z.array(
    z.object({
      categoryId: z.string().min(1),
      displayName: z.string().min(1),
      sortOrder: z.number().int(),
    }),
  ),
});

export const shoppingListShareSnapshotSchema = z.object({
  items: z.array(sharedShoppingSnapshotItemSchema),
  stores: z.array(sharedShoppingSnapshotStoreSchema),
});

export function parseShoppingListShareSnapshot(
  value: unknown,
): SharedShoppingSnapshot | null {
  const parsed = shoppingListShareSnapshotSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function buildShoppingShareItemSelectionKey({
  sourceKey,
  sourceType,
}: {
  sourceKey: string;
  sourceType: string;
}) {
  return `${sourceType}:${sourceKey}`;
}

export function parseShoppingShareItemSelectionKey(value: string) {
  const separatorIndex = value.indexOf(":");

  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return null;
  }

  return {
    sourceKey: value.slice(separatorIndex + 1),
    sourceType: value.slice(0, separatorIndex),
  };
}
