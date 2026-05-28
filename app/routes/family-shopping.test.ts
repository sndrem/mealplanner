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

vi.mock("../lib/shopping-preference-write.server", () => ({
  parseFamilyShoppingListMode: vi.fn(),
  updateFamilyShoppingListMode: vi.fn(),
}));

vi.mock("../lib/shopping-write.server", () => ({
  toggleShoppingItemChecked: vi.fn(),
}));

import { requireUser } from "../lib/auth.server";
import {
  createQuickFamilyShoppingItem,
  parseQuickAddFamilyShoppingItemInput,
  toggleFamilyShoppingItemChecked,
} from "../lib/family-shopping-write.server";
import {
  parseFamilyShoppingListMode,
  updateFamilyShoppingListMode,
} from "../lib/shopping-preference-write.server";
import { toggleShoppingItemChecked } from "../lib/shopping-write.server";
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
      activeListMode: "GLOBAL",
      canOfferCombined: false,
      categories: [],
      family: { id: "family-1", name: "Solberg" },
      itemCounts: {
        checked: 0,
        family: 1,
        mealPlan: 0,
        total: 1,
        unchecked: 1,
      },
      mealPlanItemCount: 0,
      projectedItems: [],
      savedListMode: "GLOBAL",
      todayMealPlan: null,
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

  it("redirects after a family quick-add", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(parseQuickAddFamilyShoppingItemInput).mockReturnValue({
      ingredientId: "ingredient-1",
      name: "Melk",
      recentNameNormalized: "",
    });
    vi.mocked(createQuickFamilyShoppingItem).mockResolvedValue({
      status: "CREATED",
    });

    const formData = new FormData();
    formData.set("intent", "quick-add-family-shopping-item");
    formData.set("name", "Melk");

    const response = await action({
      params: { familyId: "family-1" },
      request: new Request("http://localhost/families/family-1/shopping", {
        body: formData,
        method: "POST",
      }),
    });

    expect(createQuickFamilyShoppingItem).toHaveBeenCalledWith({
      familyId: "family-1",
      input: {
        ingredientId: "ingredient-1",
        name: "Melk",
        recentNameNormalized: "",
      },
      userId: "user-1",
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/shopping?notice=family-shopping-item-added",
    );
  });

  it("returns quick-add validation errors without redirecting", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(parseQuickAddFamilyShoppingItemInput).mockReturnValue({
      ingredientId: "",
      name: "",
      recentNameNormalized: "",
    });
    vi.mocked(createQuickFamilyShoppingItem).mockResolvedValue({
      fieldErrors: {
        name: "Skriv inn et varenavn.",
      },
      formError: "Kunne ikke legge til varen.",
      status: "VALIDATION_ERROR",
      values: {
        categoryId: "",
        name: "",
        note: "",
        preferredStoreId: "",
        quantity: "",
      },
    });

    const formData = new FormData();
    formData.set("intent", "quick-add-family-shopping-item");

    const result = await action({
      params: { familyId: "family-1" },
      request: new Request("http://localhost/families/family-1/shopping", {
        body: formData,
        method: "POST",
      }),
    });

    expect(result).toEqual({
      familyFieldErrors: {
        name: "Skriv inn et varenavn.",
      },
      familyValues: {
        categoryId: "",
        name: "",
        note: "",
        preferredStoreId: "",
        quantity: "",
      },
      formError: "Kunne ikke legge til varen.",
      intent: "quick-add-family-shopping-item",
    });
  });

  it("updates shopping list mode from the route action", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(parseFamilyShoppingListMode).mockReturnValue("COMBINED");
    vi.mocked(updateFamilyShoppingListMode).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "set-family-shopping-list-mode");
    formData.set("listMode", "COMBINED");

    const response = await action({
      params: { familyId: "family-1" },
      request: new Request("http://localhost/families/family-1/shopping", {
        body: formData,
        method: "POST",
      }),
    });

    expect(updateFamilyShoppingListMode).toHaveBeenCalledWith({
      familyId: "family-1",
      listMode: "COMBINED",
      userId: "user-1",
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/shopping?notice=family-shopping-list-mode-updated",
    );
  });

  it("toggles a meal-plan shopping item from the route action", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(toggleShoppingItemChecked).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "toggle-meal-plan-shopping-item-checked");
    formData.set("mealPlanId", "meal-plan-1");
    formData.set("sourceKey", "generated-1");
    formData.set("sourceType", "GENERATED");
    formData.set("checked", "true");
    formData.set("expectedUpdatedAt", "2026-05-10T00:00:00.000Z");

    const response = await action({
      params: { familyId: "family-1" },
      request: new Request("http://localhost/families/family-1/shopping", {
        body: formData,
        method: "POST",
      }),
    });

    expect(toggleShoppingItemChecked).toHaveBeenCalledWith({
      checked: true,
      expectedUpdatedAt: "2026-05-10T00:00:00.000Z",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "generated-1",
      sourceType: "GENERATED",
      userId: "user-1",
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
  });
});
