import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock } = vi.hoisted(() => {
  return {
    dbMock: {
      familyShoppingItem: {
        create: vi.fn(),
        deleteMany: vi.fn(),
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
      ingredientCategory: {
        findUnique: vi.fn(),
      },
      store: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    requireFamilyMembershipMock: vi.fn(),
  };
});

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  requireFamilyMembership: requireFamilyMembershipMock,
}));

vi.mock("./shopping-write.server", () => ({
  resolveOtherCategoryId: vi.fn(),
  resolveQuickAddManualShoppingItemValues: vi.fn(),
}));

import { resolveQuickAddManualShoppingItemValues } from "./shopping-write.server";
import {
  createFamilyShoppingItem,
  parseQuickAddFamilyShoppingItemInput,
  toggleFamilyShoppingItemChecked,
  updateFamilyShoppingItemQuantity,
} from "./family-shopping-write.server";

describe("family-shopping-write.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyMembershipMock.mockResolvedValue({
      familyId: "family-1",
      role: "MEMBER",
      userId: "user-1",
    });
    dbMock.ingredientCategory.findUnique.mockResolvedValue({
      id: "category-other",
    });
    dbMock.store.findFirst.mockResolvedValue(null);
  });

  it("rejects empty family shopping item names", async () => {
    const result = await createFamilyShoppingItem({
      familyId: "family-1",
      userId: "user-1",
      values: {
        categoryId: "category-other",
        name: "   ",
        note: "",
        preferredStoreId: "",
        quantity: "",
      },
    });

    expect(result.status).toBe("VALIDATION_ERROR");
    expect(result.fieldErrors?.name).toBeTruthy();
  });

  it("creates a family shopping item", async () => {
    dbMock.familyShoppingItem.create.mockResolvedValue({ id: "family-item-1" });

    const result = await createFamilyShoppingItem({
      familyId: "family-1",
      userId: "user-1",
      values: {
        categoryId: "category-other",
        name: "Batterier",
        note: "",
        preferredStoreId: "",
        quantity: "1 pk",
      },
    });

    expect(result).toEqual({
      familyItemId: "family-item-1",
      status: "CREATED",
    });
    expect(dbMock.familyShoppingItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          familyId: "family-1",
          name: "Batterier",
        }),
      }),
    );
  });

  it("toggles checked state on the family shopping item row", async () => {
    dbMock.familyShoppingItem.findFirst.mockResolvedValue({
      checked: false,
      id: "family-item-1",
      updatedAt: new Date("2026-05-10T00:00:00.000Z"),
    });
    dbMock.familyShoppingItem.updateMany.mockResolvedValue({ count: 1 });

    const result = await toggleFamilyShoppingItemChecked({
      checked: true,
      expectedUpdatedAt: "2026-05-10T00:00:00.000Z",
      familyId: "family-1",
      familyItemId: "family-item-1",
      userId: "user-1",
    });

    expect(result).toEqual({ status: "UPDATED" });
    expect(dbMock.familyShoppingItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checked: true,
        }),
      }),
    );
  });

  it("quick-add delegates to manual resolver before creating", async () => {
    vi.mocked(resolveQuickAddManualShoppingItemValues).mockResolvedValue({
      ok: true,
      values: {
        buyOnDate: "",
        categoryId: "category-other",
        name: "Batterier",
        note: "",
        preferredStoreId: "",
        quantity: "1",
      },
    });
    dbMock.familyShoppingItem.create.mockResolvedValue({ id: "family-item-1" });
    dbMock.store.findMany.mockResolvedValue([]);
    dbMock.familyShoppingItem.findFirst.mockResolvedValue({
      category: {
        displayName: "Annet",
        id: "category-other",
      },
      categoryId: "category-other",
      checked: false,
      id: "family-item-1",
      name: "Batterier",
      note: null,
      preferredStore: null,
      preferredStoreId: null,
      quantity: "1",
      updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    });

    const { createQuickFamilyShoppingItem } = await import(
      "./family-shopping-write.server"
    );

    const result = await createQuickFamilyShoppingItem({
      familyId: "family-1",
      input: { name: "Batterier" },
      userId: "user-1",
    });

    expect(result).toEqual({
      item: {
        category: { id: "category-other", name: "Annet" },
        checked: false,
        collaborationVersion: "2026-05-31T00:00:00.000Z",
        mealPlanId: null,
        mealPlanTitle: null,
        name: "Batterier",
        note: null,
        preferredStore: null,
        quantity: "1",
        quantityLabel: "1",
        section: {
          displayName: "Annet",
          sortOrder: expect.any(Number),
        },
        sourceKey: "family-item-1",
        sourceType: "FAMILY",
      },
      recentManualItem: {
        categoryId: "category-other",
        displayName: "Batterier",
        nameNormalized: "batterier",
        quantity: "1",
      },
      status: "CREATED",
    });
  });

  it("parses quick-add input quantity from form data", () => {
    const formData = new FormData();
    formData.set("name", "Melk");
    formData.set("quantity", "4 flasker");

    expect(parseQuickAddFamilyShoppingItemInput(formData)).toEqual({
      ingredientId: "",
      name: "Melk",
      quantity: "4 flasker",
      recentNameNormalized: "",
    });
  });

  it("updates quantity on a family shopping item", async () => {
    dbMock.familyShoppingItem.findFirst.mockResolvedValue({
      id: "family-item-1",
      updatedAt: new Date("2026-05-10T00:00:00.000Z"),
    });
    dbMock.familyShoppingItem.updateMany.mockResolvedValue({ count: 1 });

    const result = await updateFamilyShoppingItemQuantity({
      expectedUpdatedAt: "2026-05-10T00:00:00.000Z",
      familyId: "family-1",
      familyItemId: "family-item-1",
      quantity: " 4 flasker ",
      userId: "user-1",
    });

    expect(result).toEqual({ status: "UPDATED" });
    expect(dbMock.familyShoppingItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantity: "4 flasker",
        }),
      }),
    );
  });
});
