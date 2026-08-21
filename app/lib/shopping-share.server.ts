import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import type { SharedShoppingSnapshot } from "./shopping-section-groups";
import {
  buildShoppingShareItemSelectionKey,
  parseShoppingListShareSnapshot,
} from "./shopping-share";
import {
  getFamilyStoreModeData,
  loadFamilyShoppingItems,
  type ProjectedShoppingItem,
} from "./shopping.server";
import { listScopedStores } from "./store.server";

export interface ShoppingShareCurationItem {
  category: {
    id: string;
    name: string;
  };
  checked: boolean;
  name: string;
  note: string | null;
  quantityLabel: string | null;
  sourceKey: string;
  sourceType: "FAMILY" | "GENERATED" | "MANUAL";
}

export interface ShoppingShareCurationData {
  alreadyCheckedItems: ShoppingShareCurationItem[];
  family: {
    id: string;
    name: string;
  };
  pendingItems: ShoppingShareCurationItem[];
}

export type CreateShoppingListShareResult =
  | { formError: string; status: "VALIDATION_ERROR" }
  | { status: "NOT_FOUND" }
  | { status: "OK"; token: string };

export function hashShoppingListShareToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createShoppingListShareRawToken() {
  return randomBytes(32).toString("hex");
}

export async function getShoppingShareCurationData({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}): Promise<ShoppingShareCurationData | null> {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });
  const storeModeData = await getFamilyStoreModeData({
    familyId,
    userId,
  });

  if (!storeModeData) {
    return null;
  }

  const dueItems = flattenDueItems(storeModeData.dueSectionGroups);
  const checkedFamilyItems = await loadFamilyShoppingItems({
    checked: true,
    familyId,
  });
  const items = mergeCurationItems(dueItems, checkedFamilyItems);

  return {
    alreadyCheckedItems: items.filter((item) => item.checked),
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    pendingItems: items.filter((item) => !item.checked),
  };
}

export async function createShoppingListShare({
  familyId,
  selectedKeys,
  userId,
}: {
  familyId: string;
  selectedKeys: string[];
  userId: string;
}): Promise<CreateShoppingListShareResult> {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const uniqueSelectedKeys = [...new Set(selectedKeys.filter((key) => key.length > 0))];

  if (uniqueSelectedKeys.length === 0) {
    return {
      formError: "Velg minst én vare å dele.",
      status: "VALIDATION_ERROR",
    };
  }

  const storeModeData = await getFamilyStoreModeData({
    familyId,
    userId,
  });

  if (!storeModeData) {
    return { status: "NOT_FOUND" };
  }

  const dueItems = flattenDueItems(storeModeData.dueSectionGroups);
  const checkedFamilyItems = await loadFamilyShoppingItems({
    checked: true,
    familyId,
  });
  const candidates = mergeCurationItems(dueItems, checkedFamilyItems);
  const selectedKeySet = new Set(uniqueSelectedKeys);
  const selectedItems = candidates.filter((item) =>
    selectedKeySet.has(
      buildShoppingShareItemSelectionKey({
        sourceKey: item.sourceKey,
        sourceType: item.sourceType,
      }),
    ),
  );

  if (selectedItems.length === 0) {
    return {
      formError: "Velg minst én vare å dele.",
      status: "VALIDATION_ERROR",
    };
  }

  const stores = await listScopedStores(familyId);
  const snapshot: SharedShoppingSnapshot = {
    items: selectedItems.map((item) => ({
      categoryId: item.category.id,
      categoryName: item.category.name,
      id: buildShoppingShareItemSelectionKey({
        sourceKey: item.sourceKey,
        sourceType: item.sourceType,
      }),
      name: item.name,
      note: item.note,
      quantityLabel: item.quantityLabel,
    })),
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      sections: store.sections.map((section) => ({
        categoryId: section.categoryId,
        displayName: section.displayName,
        sortOrder: section.sortOrder,
      })),
    })),
  };
  const token = createShoppingListShareRawToken();

  await db.shoppingListShare.create({
    data: {
      createdByUserId: userId,
      familyId,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      tokenHash: hashShoppingListShareToken(token),
    },
  });

  return {
    status: "OK",
    token,
  };
}

export async function getShoppingListShareByToken(token: string) {
  const trimmedToken = token.trim();

  if (!trimmedToken) {
    return null;
  }

  const share = await db.shoppingListShare.findUnique({
    select: {
      snapshot: true,
    },
    where: {
      tokenHash: hashShoppingListShareToken(trimmedToken),
    },
  });

  if (!share) {
    return null;
  }

  const snapshot = parseShoppingListShareSnapshot(share.snapshot);

  return snapshot ? { snapshot } : null;
}

function flattenDueItems(
  dueSectionGroups: Array<{ items: ProjectedShoppingItem[] }>,
) {
  return dueSectionGroups.flatMap((section) => section.items);
}

function mergeCurationItems(
  dueItems: ProjectedShoppingItem[],
  checkedFamilyItems: Array<{
    category: { displayName: string; id: string };
    checked: boolean;
    id: string;
    name: string;
    note: string | null;
    quantity: string | null;
  }>,
): ShoppingShareCurationItem[] {
  const dueKeys = new Set(
    dueItems.map((item) =>
      buildShoppingShareItemSelectionKey({
        sourceKey: item.sourceKey,
        sourceType: item.sourceType,
      }),
    ),
  );
  const extraFamilyItems = checkedFamilyItems
    .filter(
      (item) =>
        !dueKeys.has(
          buildShoppingShareItemSelectionKey({
            sourceKey: item.id,
            sourceType: "FAMILY",
          }),
        ),
    )
    .map(mapFamilyRowToCurationItem);

  return [...dueItems.map(mapProjectedItemToCurationItem), ...extraFamilyItems];
}

function mapProjectedItemToCurationItem(
  item: ProjectedShoppingItem,
): ShoppingShareCurationItem {
  return {
    category: item.category,
    checked: item.checked,
    name: item.name,
    note: item.note,
    quantityLabel: item.quantityLabel,
    sourceKey: item.sourceKey,
    sourceType: item.sourceType,
  };
}

function mapFamilyRowToCurationItem(item: {
  category: { displayName: string; id: string };
  checked: boolean;
  id: string;
  name: string;
  note: string | null;
  quantity: string | null;
}): ShoppingShareCurationItem {
  const quantityLabel = item.quantity?.trim() || null;

  return {
    category: {
      id: item.category.id,
      name: item.category.displayName,
    },
    checked: item.checked,
    name: item.name,
    note: item.note,
    quantityLabel,
    sourceKey: item.id,
    sourceType: "FAMILY",
  };
}
