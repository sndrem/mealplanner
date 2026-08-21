import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/shopping-share.server", () => ({
  getShoppingListShareByToken: vi.fn(),
}));

import { getShoppingListShareByToken } from "../lib/shopping-share.server";
import { loader } from "./shopping-list-share";

describe("shopping list share route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads a snapshot without requiring a session", async () => {
    vi.mocked(getShoppingListShareByToken).mockResolvedValue({
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
        stores: [
          {
            id: "store-rema",
            name: "Rema 1000",
            sections: [],
          },
        ],
      },
    });

    const result = await loader({
      params: { token: "share-token" },
      request: new Request("http://localhost/s/share-token"),
    } as never);

    expect(getShoppingListShareByToken).toHaveBeenCalledWith("share-token");
    expect(result.snapshot.items[0]?.name).toBe("Melk");
    expect(result.token).toBe("share-token");
  });

  it("returns 404 for an unknown token", async () => {
    vi.mocked(getShoppingListShareByToken).mockResolvedValue(null);

    await expect(
      loader({
        params: { token: "missing" },
        request: new Request("http://localhost/s/missing"),
      } as never),
    ).rejects.toMatchObject({
      status: 404,
    });
  });
});
