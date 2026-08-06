import { ShoppingItemSource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    shoppingItemCheckEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("./db.server", () => ({
  db: dbMock,
}));

import {
  listShoppingCheckHistoryForStoreMode,
  recordShoppingCheckEvent,
  resolveMealPlanShoppingItemName,
  SHOPPING_CHECK_HISTORY_LIMIT,
} from "./shopping-check-history.server";

describe("shopping-check-history.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a shopping check event with a trimmed item name", async () => {
    dbMock.shoppingItemCheckEvent.create.mockResolvedValue({
      id: "event-1",
    });

    await recordShoppingCheckEvent(dbMock as never, {
      actorUserId: "user-1",
      checked: true,
      familyId: "family-1",
      itemName: "  Melk  ",
      mealPlanId: null,
      sourceType: null,
      targetKey: "family-item-1",
      targetType: "FAMILY_ITEM",
    });

    expect(dbMock.shoppingItemCheckEvent.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user-1",
        checked: true,
        familyId: "family-1",
        itemName: "Melk",
        mealPlanId: null,
        sourceType: null,
        targetKey: "family-item-1",
        targetType: "FAMILY_ITEM",
      },
    });
  });

  it("resolves manual item names from the meal plan", async () => {
    const client = {
      manualShoppingItem: {
        findFirst: vi.fn().mockResolvedValue({ name: "Kaffe" }),
      },
      recipeIngredient: {
        findUnique: vi.fn(),
      },
    };

    await expect(
      resolveMealPlanShoppingItemName(client as never, {
        mealPlanId: "meal-plan-1",
        sourceKey: "manual-1",
        sourceType: ShoppingItemSource.MANUAL,
      }),
    ).resolves.toBe("Kaffe");
  });

  it("resolves generated item names from the first occurrence key", async () => {
    const client = {
      manualShoppingItem: {
        findFirst: vi.fn(),
      },
      recipeIngredient: {
        findUnique: vi.fn().mockResolvedValue({ displayName: "Paprika" }),
      },
    };

    await expect(
      resolveMealPlanShoppingItemName(client as never, {
        mealPlanId: "meal-plan-1",
        sourceKey: "entry-1:ingredient-1|entry-2:ingredient-2",
        sourceType: ShoppingItemSource.GENERATED,
      }),
    ).resolves.toBe("Paprika");

    expect(client.recipeIngredient.findUnique).toHaveBeenCalledWith({
      select: {
        displayName: true,
      },
      where: {
        id: "ingredient-1",
      },
    });
  });

  it("lists capped store-mode history newest first", async () => {
    dbMock.shoppingItemCheckEvent.findMany.mockResolvedValue([
      {
        actorUser: { displayName: "Sindre" },
        checked: true,
        createdAt: new Date("2026-05-16T10:00:00.000Z"),
        id: "event-1",
        itemName: "Melk",
        sourceType: null,
        targetKey: "family-item-1",
        targetType: "FAMILY_ITEM",
      },
      {
        actorUser: { displayName: "Kari" },
        checked: false,
        createdAt: new Date("2026-05-16T09:00:00.000Z"),
        id: "event-2",
        itemName: "Paprika",
        sourceType: ShoppingItemSource.GENERATED,
        targetKey: "entry-1:ingredient-1",
        targetType: "MEAL_PLAN_ITEM",
      },
    ]);

    const history = await listShoppingCheckHistoryForStoreMode({
      familyId: "family-1",
      mealPlanIds: ["meal-plan-1", "meal-plan-2"],
    });

    expect(dbMock.shoppingItemCheckEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: SHOPPING_CHECK_HISTORY_LIMIT,
        where: {
          familyId: "family-1",
          OR: [
            { mealPlanId: { in: ["meal-plan-1", "meal-plan-2"] } },
            { targetType: "FAMILY_ITEM" },
          ],
        },
      }),
    );
    expect(history).toEqual([
      {
        actorDisplayName: "Sindre",
        checked: true,
        id: "event-1",
        itemName: "Melk",
        occurredAt: "2026-05-16T10:00:00.000Z",
        sourceKey: "family-item-1",
        sourceType: "FAMILY",
      },
      {
        actorDisplayName: "Kari",
        checked: false,
        id: "event-2",
        itemName: "Paprika",
        occurredAt: "2026-05-16T09:00:00.000Z",
        sourceKey: "entry-1:ingredient-1",
        sourceType: "GENERATED",
      },
    ]);
  });
});
