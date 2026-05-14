import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyAdminMock, requireFamilyMembershipMock, transactionMock } = vi.hoisted(() => {
  const transactionMock = {
    store: {
      update: vi.fn(),
    },
    storeSection: {
      update: vi.fn(),
    },
  };

  return {
    dbMock: {
      $transaction: vi.fn(),
      ingredientCategory: {
        findMany: vi.fn(),
      },
      store: {
        create: vi.fn(),
        delete: vi.fn(),
        findFirst: vi.fn(),
      },
      storeSection: {
        update: vi.fn(),
      },
      userStorePreference: {
        deleteMany: vi.fn(),
        upsert: vi.fn(),
      },
    },
    requireFamilyAdminMock: vi.fn(),
    requireFamilyMembershipMock: vi.fn(),
    transactionMock,
  };
});

vi.mock("./db.server", () => {
  return {
    db: dbMock,
  };
});

vi.mock("./family.server", () => {
  return {
    requireFamilyAdmin: requireFamilyAdminMock,
    requireFamilyMembership: requireFamilyMembershipMock,
  };
});

import {
  createFamilyStore,
  deleteFamilyStore,
  updateFamilyStore,
  updateSelectedStorePreference,
} from "./store-write.server";

describe("store-write.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyAdminMock.mockResolvedValue({
      familyId: "family-1",
      role: "ADMIN",
      userId: "user-1",
    });
    requireFamilyMembershipMock.mockResolvedValue({
      familyId: "family-1",
      role: "MEMBER",
      userId: "user-1",
    });
    dbMock.ingredientCategory.findMany.mockResolvedValue([
      {
        displayName: "Bakst og brod",
        id: "category-bakery",
      },
      {
        displayName: "Frukt og gront",
        id: "category-produce",
      },
    ]);
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof transactionMock) => unknown) =>
      callback(transactionMock),
    );
  });

  it("returns validation errors before creating a family store", async () => {
    const result = await createFamilyStore({
      familyId: "family-1",
      name: "   ",
      userId: "user-1",
    });

    expect(result).toEqual({
      fieldErrors: {
        name: "Skriv inn et butikknavn.",
      },
      status: "VALIDATION_ERROR",
      values: {
        name: "",
      },
    });
    expect(dbMock.store.create).not.toHaveBeenCalled();
  });

  it("creates a family store with default sections for all categories", async () => {
    dbMock.store.findFirst.mockResolvedValue(null);
    dbMock.store.create.mockResolvedValue({
      id: "store-1",
      name: "Helgebutikk",
    });

    const result = await createFamilyStore({
      familyId: "family-1",
      name: "  Helgebutikk  ",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "CREATED",
      store: {
        id: "store-1",
        name: "Helgebutikk",
      },
    });
    expect(dbMock.store.create).toHaveBeenCalledWith({
      data: {
        familyId: "family-1",
        name: "Helgebutikk",
        sections: {
          create: [
            {
              categoryId: "category-bakery",
              displayName: "Bakst og brod",
              sortOrder: 1,
            },
            {
              categoryId: "category-produce",
              displayName: "Frukt og gront",
              sortOrder: 2,
            },
          ],
        },
      },
      select: {
        id: true,
        name: true,
      },
    });
  });

  it("updates a family store name and section labels", async () => {
    dbMock.store.findFirst
      .mockResolvedValueOnce({
        id: "store-1",
        sections: [
          {
            categoryId: "category-bakery",
            id: "section-1",
          },
          {
            categoryId: "category-produce",
            id: "section-2",
          },
        ],
      })
      .mockResolvedValueOnce(null);

    const result = await updateFamilyStore({
      familyId: "family-1",
      storeId: "store-1",
      userId: "user-1",
      values: {
        name: "  Helgebutikk  ",
        sections: [
          {
            categoryId: "category-produce",
            displayName: "Gront først",
          },
          {
            categoryId: "category-bakery",
            displayName: "Brodhylla",
          },
        ],
      },
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(transactionMock.store.update).toHaveBeenCalledWith({
      data: {
        name: "Helgebutikk",
      },
      where: {
        id: "store-1",
      },
    });
    expect(transactionMock.storeSection.update).toHaveBeenNthCalledWith(1, {
      data: {
        displayName: "Gront først",
        sortOrder: 1,
      },
      where: {
        storeId_categoryId: {
          categoryId: "category-produce",
          storeId: "store-1",
        },
      },
    });
    expect(transactionMock.storeSection.update).toHaveBeenNthCalledWith(2, {
      data: {
        displayName: "Brodhylla",
        sortOrder: 2,
      },
      where: {
        storeId_categoryId: {
          categoryId: "category-bakery",
          storeId: "store-1",
        },
      },
    });
  });

  it("deletes a scoped family store", async () => {
    dbMock.store.findFirst.mockResolvedValue({
      id: "store-1",
    });

    const result = await deleteFamilyStore({
      familyId: "family-1",
      storeId: "store-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "DELETED",
    });
    expect(dbMock.store.delete).toHaveBeenCalledWith({
      where: {
        id: "store-1",
      },
    });
  });

  it("upserts the selected store preference for a user", async () => {
    dbMock.store.findFirst.mockResolvedValue({
      id: "store-2",
    });

    const result = await updateSelectedStorePreference({
      familyId: "family-1",
      selectedStoreId: "store-2",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(dbMock.userStorePreference.upsert).toHaveBeenCalledWith({
      create: {
        familyId: "family-1",
        selectedStoreId: "store-2",
        userId: "user-1",
      },
      update: {
        selectedStoreId: "store-2",
      },
      where: {
        userId_familyId: {
          familyId: "family-1",
          userId: "user-1",
        },
      },
    });
  });
});
