import { afterEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock } = vi.hoisted(() => ({
  dbMock: {
    userStorePreference: {
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
  parseStoreModeTripFocus,
  updateStoreModeTripFocus,
} from "./store-mode-trip-focus-write.server";

describe("store-mode-trip-focus-write.server", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("parses valid trip focus values", () => {
    expect(parseStoreModeTripFocus("CURRENT")).toBe("CURRENT");
    expect(parseStoreModeTripFocus("NEXT")).toBe("NEXT");
    expect(parseStoreModeTripFocus("ALL")).toBe("ALL");
    expect(parseStoreModeTripFocus("INVALID")).toBeNull();
  });

  it("upserts the trip focus for the user and family", async () => {
    requireFamilyMembershipMock.mockResolvedValue({
      family: { id: "family-1", name: "Solberg" },
      role: "ADMIN",
    });

    const result = await updateStoreModeTripFocus({
      familyId: "family-1",
      tripFocus: "NEXT",
      userId: "user-1",
    });

    expect(result).toEqual({ status: "UPDATED" });
    expect(dbMock.userStorePreference.upsert).toHaveBeenCalledWith({
      create: {
        familyId: "family-1",
        storeModeTripFocus: "NEXT",
        userId: "user-1",
      },
      update: {
        storeModeTripFocus: "NEXT",
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
