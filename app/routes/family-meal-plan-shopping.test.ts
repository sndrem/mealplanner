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
    getMealPlanShoppingData: vi.fn(),
  };
});

vi.mock("../lib/shopping-write.server", () => {
  return {
    createManualShoppingItem: vi.fn(),
    deleteManualShoppingItem: vi.fn(),
    toggleShoppingItemChecked: vi.fn(),
    updateGeneratedShoppingItemOverride: vi.fn(),
    updateManualShoppingItem: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { getMealPlanShoppingData } from "../lib/shopping.server";
import {
  createManualShoppingItem,
  toggleShoppingItemChecked,
  updateGeneratedShoppingItemOverride,
} from "../lib/shopping-write.server";
import { action, loader } from "./family-meal-plan-shopping";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(url = "http://localhost/families/family-1/meal-plans/meal-plan-1/shopping", formData?: FormData) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family meal plan shopping route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads and serializes generated and manual shopping data", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getMealPlanShoppingData).mockResolvedValue({
      categories: [
        {
          displayName: "Frukt og gront",
          id: "category-produce",
        },
      ],
      family: {
        id: "family-1",
        name: "Solberg",
      },
      itemCounts: {
        generated: 1,
        manual: 1,
        total: 2,
      },
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
      },
      projectedItems: [
        {
          amount: "1",
          category: {
            id: "category-produce",
            name: "Frukt og gront",
          },
          checked: false,
          firstDate: new Date("2026-05-15T00:00:00.000Z"),
          lastDate: new Date("2026-05-16T00:00:00.000Z"),
          name: "Lime",
          note: null,
          occurrenceCount: 1,
          occurrences: [
            {
              date: new Date("2026-05-15T00:00:00.000Z"),
              mealPlanEntryId: "entry-1",
              recipeId: "recipe-1",
              recipeIngredientId: "ingredient-1",
              recipeTitle: "Taco",
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
          sourceType: "GENERATED",
          unit: "stk",
        },
        {
          buyOnDate: new Date("2026-05-18T00:00:00.000Z"),
          category: {
            id: "category-produce",
            name: "Frukt og gront",
          },
          checked: true,
          name: "Bananer",
          note: "Til smoothien",
          preferredStore: {
            id: "store-1",
            name: "Meny",
          },
          quantity: "6 stk",
          quantityLabel: "6 stk",
          section: {
            displayName: "Frukt og gront",
            sortOrder: 1,
          },
          sourceKey: "manual-item-1",
          sourceType: "MANUAL",
        },
      ],
      storeGroups: [
        {
          sections: [
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
                  lastDate: new Date("2026-05-16T00:00:00.000Z"),
                  name: "Lime",
                  note: null,
                  occurrenceCount: 1,
                  occurrences: [
                    {
                      date: new Date("2026-05-15T00:00:00.000Z"),
                      mealPlanEntryId: "entry-1",
                      recipeId: "recipe-1",
                      recipeIngredientId: "ingredient-1",
                      recipeTitle: "Taco",
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
                  sourceType: "GENERATED",
                  unit: "stk",
                },
                {
                  buyOnDate: new Date("2026-05-18T00:00:00.000Z"),
                  category: {
                    id: "category-produce",
                    name: "Frukt og gront",
                  },
                  checked: true,
                  name: "Bananer",
                  note: "Til smoothien",
                  preferredStore: {
                    id: "store-1",
                    name: "Meny",
                  },
                  quantity: "6 stk",
                  quantityLabel: "6 stk",
                  section: {
                    displayName: "Frukt og gront",
                    sortOrder: 1,
                  },
                  sourceKey: "manual-item-1",
                  sourceType: "MANUAL",
                },
              ],
            },
          ],
          store: {
            id: "store-1",
            name: "Meny",
          },
        },
      ],
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

    expect(getMealPlanShoppingData).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(result).toEqual({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      itemCounts: {
        generated: 1,
        manual: 1,
        total: 2,
      },
      mealPlan: {
        activeShoppingDate: "2026-05-16",
        endDate: "2026-05-18",
        entries: undefined,
        id: "meal-plan-1",
        manualShoppingItems: undefined,
        shoppingOverrides: undefined,
        startDate: "2026-05-15",
        status: "DRAFT",
        title: "Langhelg",
      },
      notice: null,
      categories: [
        {
          displayName: "Frukt og gront",
          id: "category-produce",
        },
      ],
      storeGroups: [
        {
          sections: [
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
                  firstDate: "2026-05-15",
                  lastDate: "2026-05-16",
                  name: "Lime",
                  note: null,
                  occurrenceCount: 1,
                  occurrences: [
                    {
                      date: "2026-05-15",
                      mealPlanEntryId: "entry-1",
                      recipeId: "recipe-1",
                      recipeIngredientId: "ingredient-1",
                      recipeTitle: "Taco",
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
                  sourceType: "GENERATED",
                  unit: "stk",
                },
                {
                  buyOnDate: "2026-05-18",
                  category: {
                    id: "category-produce",
                    name: "Frukt og gront",
                  },
                  checked: true,
                  name: "Bananer",
                  note: "Til smoothien",
                  preferredStore: {
                    id: "store-1",
                    name: "Meny",
                  },
                  quantity: "6 stk",
                  quantityLabel: "6 stk",
                  section: {
                    displayName: "Frukt og gront",
                    sortOrder: 1,
                  },
                  sourceKey: "manual-item-1",
                  sourceType: "MANUAL",
                },
              ],
            },
          ],
          store: {
            id: "store-1",
            name: "Meny",
          },
        },
      ],
      stores: [
        {
          id: "store-1",
          name: "Meny",
        },
      ],
      userRole: "ADMIN",
      visibleDates: ["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"],
    });
  });

  it("returns manual item validation errors from the server module", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(createManualShoppingItem).mockResolvedValue({
      fieldErrors: {
        name: "Skriv inn et varenavn.",
      },
      status: "VALIDATION_ERROR",
      values: {
        buyOnDate: "",
        categoryId: "category-produce",
        name: "",
        note: "Til dessert",
        preferredStoreId: "",
        quantity: "2 stk",
      },
    });

    const formData = new FormData();
    formData.set("intent", "add-manual-shopping-item");
    formData.set("name", "  ");
    formData.set("quantity", "2 stk");
    formData.set("categoryId", "category-produce");
    formData.set("preferredStoreId", "");
    formData.set("buyOnDate", "");
    formData.set("note", "Til dessert");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1/shopping", formData),
    });

    expect(createManualShoppingItem).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
      values: {
        buyOnDate: "",
        categoryId: "category-produce",
        name: "  ",
        note: "Til dessert",
        preferredStoreId: "",
        quantity: "2 stk",
      },
    });
    expect(result).toEqual({
      intent: "add-manual-shopping-item",
      manualFieldErrors: {
        name: "Skriv inn et varenavn.",
      },
      manualValues: {
        buyOnDate: "",
        categoryId: "category-produce",
        name: "",
        note: "Til dessert",
        preferredStoreId: "",
        quantity: "2 stk",
      },
    });
  });

  it("redirects with a notice after toggling checked state", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(toggleShoppingItemChecked).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "toggle-shopping-item-checked");
    formData.set("sourceKey", "manual-item-1");
    formData.set("sourceType", "MANUAL");
    formData.set("checked", "true");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1/shopping", formData),
    });

    expect(toggleShoppingItemChecked).toHaveBeenCalledWith({
      checked: true,
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "manual-item-1",
      sourceType: "MANUAL",
      userId: "user-1",
    });
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1/meal-plans/meal-plan-1/shopping?notice=shopping-item-check-state-updated",
    );
  });

  it("returns generated override validation errors from the server module", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateGeneratedShoppingItemOverride).mockResolvedValue({
      fieldErrors: {
        postponedUntilDate: "Datoen ma ligge innenfor ukeplanens aktive periode.",
      },
      status: "VALIDATION_ERROR",
      values: {
        note: "Kjop senere",
        postponedUntilDate: "2026-05-21",
        preferredStoreId: "store-1",
      },
    });

    const formData = new FormData();
    formData.set("intent", "update-generated-shopping-item");
    formData.set("sourceKey", "entry-1:ingredient-1");
    formData.set("note", "Kjop senere");
    formData.set("postponedUntilDate", "2026-05-21");
    formData.set("preferredStoreId", "store-1");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1/shopping", formData),
    });

    expect(updateGeneratedShoppingItemOverride).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "entry-1:ingredient-1",
      userId: "user-1",
      values: {
        note: "Kjop senere",
        postponedUntilDate: "2026-05-21",
        preferredStoreId: "store-1",
      },
    });
    expect(result).toEqual({
      generatedOverrideFieldErrors: {
        postponedUntilDate: "Datoen ma ligge innenfor ukeplanens aktive periode.",
      },
      intent: "update-generated-shopping-item",
      itemTarget: {
        sourceKey: "entry-1:ingredient-1",
        sourceType: "GENERATED",
      },
      overrideValues: {
        note: "Kjop senere",
        postponedUntilDate: "2026-05-21",
        preferredStoreId: "store-1",
      },
    });
  });
});
