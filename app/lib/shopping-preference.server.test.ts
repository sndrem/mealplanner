import { afterEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    userFamilyShoppingPreference: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./db.server", () => ({
  db: dbMock,
}));

import {
  getShowCategoryHeadings,
  getStoreModeShoppingDisplayPreferences,
} from "./shopping-preference.server";

describe("getShowCategoryHeadings", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to visible headings when the member has no preference", async () => {
    dbMock.userFamilyShoppingPreference.findUnique.mockResolvedValue(null);

    await expect(
      getShowCategoryHeadings({
        familyId: "family-1",
        userId: "user-1",
      }),
    ).resolves.toBe(true);
  });

  it("returns the stored heading visibility", async () => {
    dbMock.userFamilyShoppingPreference.findUnique.mockResolvedValue({
      showCategoryHeadings: false,
    });

    await expect(
      getShowCategoryHeadings({
        familyId: "family-1",
        userId: "user-1",
      }),
    ).resolves.toBe(false);
  });

  it("reads grocery grouping and heading visibility in one preference row", async () => {
    dbMock.userFamilyShoppingPreference.findUnique.mockResolvedValue({
      groceryGrouping: "SPLIT",
      showCategoryHeadings: false,
    });

    await expect(
      getStoreModeShoppingDisplayPreferences({
        familyId: "family-1",
        userId: "user-1",
      }),
    ).resolves.toEqual({
      groceryGrouping: "SPLIT",
      showCategoryHeadings: false,
    });
    expect(
      dbMock.userFamilyShoppingPreference.findUnique,
    ).toHaveBeenCalledOnce();
  });
});
