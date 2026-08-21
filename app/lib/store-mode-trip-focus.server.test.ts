import { afterEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    userStorePreference: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./db.server", () => ({
  db: dbMock,
}));

import { getStoreModeTripFocus } from "./store-mode-trip-focus.server";

describe("store-mode-trip-focus.server", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns CURRENT when no preference row exists", async () => {
    dbMock.userStorePreference.findUnique.mockResolvedValue(null);

    await expect(
      getStoreModeTripFocus({
        familyId: "family-1",
        userId: "user-1",
      }),
    ).resolves.toBe("CURRENT");
  });

  it("returns the saved trip focus", async () => {
    dbMock.userStorePreference.findUnique.mockResolvedValue({
      storeModeTripFocus: "ALL",
    });

    await expect(
      getStoreModeTripFocus({
        familyId: "family-1",
        userId: "user-1",
      }),
    ).resolves.toBe("ALL");
  });
});
