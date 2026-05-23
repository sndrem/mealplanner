import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>(
    "../lib/auth.server",
  );

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/shopping.server", () => ({
  getFamilyShoppingData: vi.fn(),
  listRecentManualShoppingItemsForFamily: vi.fn(),
}));

vi.mock("../lib/family-shopping-write.server", () => ({
  createFamilyShoppingItem: vi.fn(),
  createQuickFamilyShoppingItem: vi.fn(),
  deleteFamilyShoppingItem: vi.fn(),
  parseFamilyShoppingItemValues: vi.fn(),
  parseQuickAddFamilyShoppingItemInput: vi.fn(),
  toggleFamilyShoppingItemChecked: vi.fn(),
  updateFamilyShoppingItem: vi.fn(),
}));

import { requireUser } from "../lib/auth.server";
import { toggleFamilyShoppingItemChecked } from "../lib/family-shopping-write.server";
import {
  getFamilyShoppingData,
  listRecentManualShoppingItemsForFamily,
} from "../lib/shopping.server";
import { action, loader } from "./family-shopping";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

describe("family shopping route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads family shopping data", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(listRecentManualShoppingItemsForFamily).mockResolvedValue([]);
    vi.mocked(getFamilyShoppingData).mockResolvedValue({
      categories: [],
      family: { id: "family-1", name: "Solberg" },
      itemCounts: { checked: 0, total: 1, unchecked: 1 },
      projectedItems: [],
      storeGroups: [
        {
          sections: [
            {
              category: { id: "category-other", name: "Annet" },
              displayName: "Annet",
              items: [
                {
                  category: { id: "category-other", name: "Annet" },
                  checked: false,
                  collaborationVersion: "2026-05-10T00:00:00.000Z",
                  name: "Batterier",
                  note: null,
                  preferredStore: null,
                  quantity: "1",
                  quantityLabel: "1",
                  section: {
                    displayName: "Annet",
                    sortOrder: 0,
                  },
                  sourceKey: "family-item-1",
                  sourceType: "FAMILY",
                },
              ],
            },
          ],
          store: null,
        },
      ],
      stores: [],
      userRole: "ADMIN",
    });

    const result = await loader({
      params: { familyId: "family-1" },
      request: new Request("http://localhost/families/family-1/shopping"),
    });

    expect(getFamilyShoppingData).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result.storeGroups[0]?.sections[0]?.items[0]?.name).toBe("Batterier");
  });

  it("toggles a family shopping item from the route action", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(toggleFamilyShoppingItemChecked).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "toggle-family-shopping-item-checked");
    formData.set("sourceKey", "family-item-1");
    formData.set("checked", "true");
    formData.set("expectedUpdatedAt", "2026-05-10T00:00:00.000Z");

    const response = await action({
      params: { familyId: "family-1" },
      request: new Request("http://localhost/families/family-1/shopping", {
        body: formData,
        method: "POST",
      }),
    });

    expect(toggleFamilyShoppingItemChecked).toHaveBeenCalledWith({
      checked: true,
      expectedUpdatedAt: "2026-05-10T00:00:00.000Z",
      familyId: "family-1",
      familyItemId: "family-item-1",
      userId: "user-1",
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
  });
});
