import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/shopping.server", () => {
  return {
    getMealPlanStoreModeData: vi.fn(),
    listRecentManualShoppingItemsForFamily: vi.fn(),
  };
});

vi.mock("../lib/family-shopping-write.server", () => {
  return {
    createQuickFamilyShoppingItem: vi.fn(),
    parseQuickAddFamilyShoppingItemInput: vi.fn(),
    toggleFamilyShoppingItemChecked: vi.fn(),
  };
});

vi.mock("../lib/shopping-write.server", () => {
  return {
    toggleShoppingItemChecked: vi.fn(),
    updateActiveShoppingDate: vi.fn(),
  };
});

vi.mock("../lib/store-write.server", () => {
  return {
    updateSelectedStorePreference: vi.fn(),
  };
});

import {
  createQuickFamilyShoppingItem,
  parseQuickAddFamilyShoppingItemInput,
} from "../lib/family-shopping-write.server";
import { requireUser } from "../lib/auth.server";
import {
  getMealPlanStoreModeData,
  listRecentManualShoppingItemsForFamily,
} from "../lib/shopping.server";
import { toggleShoppingItemChecked, updateActiveShoppingDate } from "../lib/shopping-write.server";
import { updateSelectedStorePreference } from "../lib/store-write.server";
import { action, loader } from "./family-meal-plan-store-mode";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(
  url = "http://localhost/families/family-1/meal-plans/meal-plan-1/store-mode",
  formData?: FormData,
) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family meal plan store mode route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads and serializes store mode data", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(listRecentManualShoppingItemsForFamily).mockResolvedValue([
      {
        categoryId: "",
        displayName: "Melk",
        nameNormalized: "melk",
        quantity: "",
      },
    ]);
    vi.mocked(getMealPlanStoreModeData).mockResolvedValue({
      activeShoppingDate: new Date("2026-05-16T00:00:00.000Z"),
      dueSectionGroups: [
        {
          category: {
            id: "category-produce",
            name: "Frukt og gront",
          },
          displayName: "Frukt og gront",
          items: [
            {
              amount: "1",
              category: {
                id: "category-produce",
                name: "Frukt og gront",
              },
              checked: false,
              firstDate: new Date("2026-05-15T00:00:00.000Z"),
              lastDate: new Date("2026-05-15T00:00:00.000Z"),
              name: "Paprika",
              note: null,
              occurrenceCount: 1,
              recipeCount: 1,
              occurrences: [
                {
                  amount: "1",
                  date: new Date("2026-05-15T00:00:00.000Z"),
                  mealPlanEntryId: "entry-1",
                  quantityLabel: "1 stk",
                  recipeId: "recipe-1",
                  recipeIngredientId: "ingredient-1",
                  recipeTitle: "Taco",
                  unit: "stk",
                },
              ],
              postponedUntilDate: null,
              preferredStore: {
                id: "store-1",
                name: "Meny",
              },
              quantityLabel: "1 stk",
              section: {
                displayName: "Frukt og gront",
                sortOrder: 1,
              },
              sourceKey: "entry-1:ingredient-1",
              collaborationVersion: "",
              preferredStoreConflict: false,
        sourceType: "GENERATED",
              unit: "stk",
            },
          ],
        },
      ],
      family: {
        id: "family-1",
        name: "Solberg",
      },
      laterItems: [],
      mealPlan: {
        activeShoppingDate: new Date("2026-05-16T00:00:00.000Z"),
        endDate: new Date("2026-05-18T00:00:00.000Z"),
        entries: [],
        id: "meal-plan-1",
        manualShoppingItems: [],
        shoppingOverrides: [],
        startDate: new Date("2026-05-15T00:00:00.000Z"),
        status: "DRAFT",
        title: "Langhelg",
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
      },
      progress: {
        checkedCount: 0,
        totalCount: 1,
      },
      selectedStore: {
        id: "store-1",
        name: "Meny",
      },
      stores: [
        {
          id: "store-1",
          name: "Meny",
        },
      ],
      userRole: "ADMIN",
      visibleDates: ["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"],
    });

    const result = await loader({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(),
    });

    expect(getMealPlanStoreModeData).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(listRecentManualShoppingItemsForFamily).toHaveBeenCalledWith({
      familyId: "family-1",
    });
    expect(result.recentManualItems).toEqual([
      {
        categoryId: "",
        displayName: "Melk",
        nameNormalized: "melk",
        quantity: "",
      },
    ]);
    expect(result.activeShoppingDate).toBe("2026-05-16");
    expect(result.mealPlan.activeShoppingDate).toBe("2026-05-16");
    expect(result.dueSectionGroups[0]?.items[0]).toEqual(
      expect.objectContaining({
        firstDate: "2026-05-15",
        lastDate: "2026-05-15",
        name: "Paprika",
      }),
    );
  });

  it("returns active shopping date validation errors from the server module", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateActiveShoppingDate).mockResolvedValue({
      fieldErrors: {
        activeShoppingDate: "Datoen må ligge innenfor ukeplanens aktive periode.",
      },
      status: "VALIDATION_ERROR",
      values: {
        activeShoppingDate: "2026-05-20",
      },
    });

    const formData = new FormData();
    formData.set("intent", "update-active-shopping-date");
    formData.set("activeShoppingDate", "2026-05-20");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(undefined, formData),
    });

    expect(updateActiveShoppingDate).toHaveBeenCalledWith({
      activeShoppingDate: "2026-05-20",
      expectedMealPlanUpdatedAt: "",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(result).toEqual({
      activeShoppingDateFieldErrors: {
        activeShoppingDate: "Datoen må ligge innenfor ukeplanens aktive periode.",
      },
      activeShoppingDateValue: "2026-05-20",
      intent: "update-active-shopping-date",
    });
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

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(undefined, formData),
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
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/meal-plans/meal-plan-1/store-mode?notice=family-shopping-item-added",
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
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(undefined, formData),
    });

    expect(result).toEqual({
      formError: "Kunne ikke legge til varen.",
      intent: "quick-add-family-shopping-item",
    });
  });

  it("redirects after updating the selected store", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateSelectedStorePreference).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "update-selected-store");
    formData.set("selectedStoreId", "store-2");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(undefined, formData),
    });

    expect(updateSelectedStorePreference).toHaveBeenCalledWith({
      familyId: "family-1",
      selectedStoreId: "store-2",
      userId: "user-1",
    });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/meal-plans/meal-plan-1/store-mode?notice=selected-store-updated",
    );
    expect(toggleShoppingItemChecked).not.toHaveBeenCalled();
  });
});
