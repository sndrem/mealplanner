import { afterEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock } = vi.hoisted(() => ({
  dbMock: {
    userFamilyShoppingPreference: {
      upsert: vi.fn(),
    },
  },
  requireFamilyMembershipMock: vi.fn(),
}));

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  requireFamilyMembership: requireFamilyMembershipMock,
}));

import {
  parseFamilyShoppingListMode,
  updateFamilyShoppingListMode,
} from "./shopping-preference-write.server";

describe("shopping-preference-write.server", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("parses valid shopping list modes", () => {
    expect(parseFamilyShoppingListMode("GLOBAL")).toBe("GLOBAL");
    expect(parseFamilyShoppingListMode("COMBINED")).toBe("COMBINED");
    expect(parseFamilyShoppingListMode("INVALID")).toBeNull();
  });

  it("upserts the shopping list mode for the user and family", async () => {
    requireFamilyMembershipMock.mockResolvedValue({
      family: { id: "family-1", name: "Solberg" },
      role: "ADMIN",
    });

    const result = await updateFamilyShoppingListMode({
      familyId: "family-1",
      listMode: "COMBINED",
      userId: "user-1",
    });

    expect(result).toEqual({ status: "UPDATED" });
    expect(dbMock.userFamilyShoppingPreference.upsert).toHaveBeenCalledWith({
      create: {
        familyId: "family-1",
        listMode: "COMBINED",
        userId: "user-1",
      },
      update: {
        listMode: "COMBINED",
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
