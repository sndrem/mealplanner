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

import { getShowCategoryHeadings } from "./shopping-preference.server";

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
});
