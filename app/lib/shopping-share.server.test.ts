import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  getFamilyStoreModeDataMock,
  listScopedStoresMock,
  loadFamilyShoppingItemsMock,
  randomBytesMock,
  requireFamilyMembershipMock,
} = vi.hoisted(() => {
  return {
    dbMock: {
      shoppingListShare: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
    },
    getFamilyStoreModeDataMock: vi.fn(),
    listScopedStoresMock: vi.fn(),
    loadFamilyShoppingItemsMock: vi.fn(),
    randomBytesMock: vi.fn(),
    requireFamilyMembershipMock: vi.fn(),
  };
});

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  requireFamilyMembership: requireFamilyMembershipMock,
}));

vi.mock("./shopping.server", () => ({
  getFamilyStoreModeData: getFamilyStoreModeDataMock,
  loadFamilyShoppingItems: loadFamilyShoppingItemsMock,
}));

vi.mock("./store.server", () => ({
  listScopedStores: listScopedStoresMock,
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();

  return {
    ...actual,
    randomBytes: randomBytesMock,
  };
});

import {
  createShoppingListShare,
  getShoppingListShareByToken,
  getShoppingShareCurationData,
  hashShoppingListShareToken,
} from "./shopping-share.server";

const RAW_TOKEN = "a".repeat(64);
const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

const pendingItem = {
  category: { id: "cat-produce", name: "Frukt og grønt" },
  checked: false,
  collaborationVersion: "",
  mealPlanId: "meal-plan-1",
  mealPlanTitle: "Langhelg",
  name: "Paprika",
  note: null,
  preferredStore: { id: "store-1", name: "Meny" },
  quantityLabel: "1 stk",
  section: { displayName: "Frukt og grønt", sortOrder: 1 },
  sourceKey: "entry-1:ingredient-1",
  sourceType: "GENERATED" as const,
  amount: "1",
  firstDate: new Date("2026-05-15T00:00:00.000Z"),
  lastDate: new Date("2026-05-15T00:00:00.000Z"),
  occurrenceCount: 1,
  occurrences: [],
  postponedUntilDate: null,
  preferredStoreConflict: false,
  quantity: null,
  recipeCount: 1,
  unit: "stk",
};

const checkedGeneratedItem = {
  ...pendingItem,
  checked: true,
  name: "Løk",
  sourceKey: "entry-1:ingredient-2",
};

const membership = {
  family: { id: "family-1", joinCode: "ABC123", name: "Solberg" },
  familyId: "family-1",
  role: "ADMIN",
  userId: "user-1",
};

function mockStoreModeData() {
  getFamilyStoreModeDataMock.mockResolvedValue({
    dueSectionGroups: [
      {
        category: { id: "cat-produce", name: "Frukt og grønt" },
        displayName: "Frukt og grønt",
        items: [pendingItem, checkedGeneratedItem],
      },
    ],
    family: { id: "family-1", name: "Solberg" },
  });
}

describe("shopping-share.server", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requires family membership and excludes checked items from pending curation", async () => {
    requireFamilyMembershipMock.mockResolvedValue(membership);
    mockStoreModeData();
    loadFamilyShoppingItemsMock.mockResolvedValue([
      {
        category: { displayName: "Meieri", id: "cat-dairy" },
        checked: true,
        id: "family-milk",
        name: "Melk",
        note: null,
        quantity: "1 l",
      },
    ]);

    const result = await getShoppingShareCurationData({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(requireFamilyMembershipMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result?.pendingItems.map((item) => item.name)).toEqual(["Paprika"]);
    expect(result?.alreadyCheckedItems.map((item) => item.name)).toEqual([
      "Løk",
      "Melk",
    ]);
  });

  it("creates a snapshot of selected items and hashed token", async () => {
    requireFamilyMembershipMock.mockResolvedValue(membership);
    mockStoreModeData();
    loadFamilyShoppingItemsMock.mockResolvedValue([]);
    listScopedStoresMock.mockResolvedValue([
      {
        id: "store-rema",
        name: "Rema 1000",
        sections: [
          {
            categoryId: "cat-produce",
            displayName: "Frukt og grønt",
            sortOrder: 1,
          },
        ],
      },
    ]);
    randomBytesMock.mockReturnValue(Buffer.from(RAW_TOKEN, "hex"));
    dbMock.shoppingListShare.create.mockResolvedValue({ id: "share-1" });

    const result = await createShoppingListShare({
      familyId: "family-1",
      selectedKeys: ["GENERATED:entry-1:ingredient-1"],
      userId: "user-1",
    });

    expect(result).toEqual({ status: "OK", token: RAW_TOKEN });
    expect(dbMock.shoppingListShare.create).toHaveBeenCalledWith({
      data: {
        createdByUserId: "user-1",
        familyId: "family-1",
        snapshot: {
          items: [
            {
              categoryId: "cat-produce",
              categoryName: "Frukt og grønt",
              id: "GENERATED:entry-1:ingredient-1",
              name: "Paprika",
              note: null,
              quantityLabel: "1 stk",
            },
          ],
          stores: [
            {
              id: "store-rema",
              name: "Rema 1000",
              sections: [
                {
                  categoryId: "cat-produce",
                  displayName: "Frukt og grønt",
                  sortOrder: 1,
                },
              ],
            },
          ],
        },
        tokenHash: TOKEN_HASH,
      },
    });
  });

  it("rejects creating a share with no selected items", async () => {
    requireFamilyMembershipMock.mockResolvedValue(membership);

    const result = await createShoppingListShare({
      familyId: "family-1",
      selectedKeys: [],
      userId: "user-1",
    });

    expect(result).toEqual({
      formError: "Velg minst én vare å dele.",
      status: "VALIDATION_ERROR",
    });
    expect(dbMock.shoppingListShare.create).not.toHaveBeenCalled();
  });

  it("loads a share by hashed token", async () => {
    dbMock.shoppingListShare.findUnique.mockResolvedValue({
      snapshot: {
        items: [
          {
            categoryId: "cat-1",
            categoryName: "Meieri",
            id: "FAMILY:milk",
            name: "Melk",
            note: null,
            quantityLabel: "1 l",
          },
        ],
        stores: [],
      },
    });

    const result = await getShoppingListShareByToken(RAW_TOKEN);

    expect(dbMock.shoppingListShare.findUnique).toHaveBeenCalledWith({
      select: { snapshot: true },
      where: { tokenHash: TOKEN_HASH },
    });
    expect(result?.snapshot.items[0]?.name).toBe("Melk");
  });

  it("returns null for an unknown token", async () => {
    dbMock.shoppingListShare.findUnique.mockResolvedValue(null);

    await expect(getShoppingListShareByToken("missing")).resolves.toBeNull();
  });

  it("returns null when the stored snapshot is invalid", async () => {
    dbMock.shoppingListShare.findUnique.mockResolvedValue({
      snapshot: { nope: true },
    });

    await expect(getShoppingListShareByToken(RAW_TOKEN)).resolves.toBeNull();
  });
});

describe("hashShoppingListShareToken", () => {
  it("hashes with sha256 hex", () => {
    expect(hashShoppingListShareToken(RAW_TOKEN)).toBe(TOKEN_HASH);
  });
});
