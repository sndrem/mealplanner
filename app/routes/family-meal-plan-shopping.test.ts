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
    listRecentManualShoppingItemsForFamily: vi.fn(),
  };
});

vi.mock("../lib/shopping-write.server", () => {
  return {
    createManualShoppingItem: vi.fn(),
    createQuickManualShoppingItem: vi.fn(),
    deleteManualShoppingItem: vi.fn(),
    optInStockShoppingItems: vi.fn(),
    toggleShoppingItemChecked: vi.fn(),
    updateGeneratedShoppingItemOverride: vi.fn(),
    updateGeneratedShoppingItemQuantity: vi.fn(),
    updateManualShoppingItem: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { getMealPlanShoppingData, listRecentManualShoppingItemsForFamily } from "../lib/shopping.server";
import {
  createManualShoppingItem,
  createQuickManualShoppingItem,
  optInStockShoppingItems,
  toggleShoppingItemChecked,
  updateGeneratedShoppingItemOverride,
  updateGeneratedShoppingItemQuantity,
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
    vi.mocked(listRecentManualShoppingItemsForFamily).mockResolvedValue([
      {
        categoryId: "category-dairy",
        displayName: "Melk",
        nameNormalized: "melk",
        quantity: "1",
      },
    ]);
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
      excludedGeneratedCount: 0,
      excludedGeneratedItems: [],
      familyStoreGroups: [],
      itemCounts: {
        family: 0,
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
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
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
          quantity: null,
          quantityLabel: "1 stk",
          section: {
            displayName: "Frukt og gront",
            sortOrder: 1,
          },
          sourceKey: "entry-1:ingredient-1",
          collaborationVersion: "",
          mealPlanId: "meal-plan-1",
          mealPlanTitle: "Langhelg",
          preferredStoreConflict: false,
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
          collaborationVersion: "2026-05-15T00:00:00.000Z",
        mealPlanId: "meal-plan-1",
        mealPlanTitle: "Langhelg",
        overrideVersion: "",
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
                  quantity: null,
                  quantityLabel: "1 stk",
                  section: {
                    displayName: "Frukt og gront",
                    sortOrder: 1,
                  },
                  sourceKey: "entry-1:ingredient-1",
                  collaborationVersion: "",
                  mealPlanId: "meal-plan-1",
                  mealPlanTitle: "Langhelg",
                  preferredStoreConflict: false,
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
                  collaborationVersion: "2026-05-15T00:00:00.000Z",
                  mealPlanId: "meal-plan-1",
                  mealPlanTitle: "Langhelg",
                  overrideVersion: "",
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
      stockIngredientCount: 0,
      stockIngredientsForPlan: [],
      stores: [
        {
          id: "store-1",
          name: "Meny",
        },
      ],
      userRole: "ADMIN",
      selectableShoppingDates: [
        "2026-05-15",
        "2026-05-16",
        "2026-05-17",
        "2026-05-18",
        "2026-05-22",
        "2026-05-23",
        "2026-05-24",
        "2026-05-25",
      ],
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
    expect(listRecentManualShoppingItemsForFamily).toHaveBeenCalledWith({
      familyId: "family-1",
    });
    expect(result).toEqual({
      excludedGeneratedCount: 0,
      excludedGeneratedItems: [],
      family: {
        id: "family-1",
        name: "Solberg",
      },
      familyStoreGroups: [],
      itemCounts: {
        family: 0,
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
        updatedAt: "2026-05-01T12:00:00.000Z",
      },
      notice: null,
      recentManualItems: [
        {
          categoryId: "category-dairy",
          displayName: "Melk",
          nameNormalized: "melk",
          quantity: "1",
        },
      ],
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
                  recipeCount: 1,
                  occurrences: [
                    {
                      amount: "1",
                      date: "2026-05-15",
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
                  quantity: null,
                  quantityLabel: "1 stk",
                  section: {
                    displayName: "Frukt og gront",
                    sortOrder: 1,
                  },
                  sourceKey: "entry-1:ingredient-1",
                  collaborationVersion: "",
                  mealPlanId: "meal-plan-1",
                  mealPlanTitle: "Langhelg",
                  preferredStoreConflict: false,
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
                  collaborationVersion: "2026-05-15T00:00:00.000Z",
                  mealPlanId: "meal-plan-1",
                  mealPlanTitle: "Langhelg",
                  overrideVersion: "",
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
      stockIngredientCount: 0,
      stockIngredientsForPlan: [],
      stores: [
        {
          id: "store-1",
          name: "Meny",
        },
      ],
      userRole: "ADMIN",
      selectableShoppingDates: [
        "2026-05-15",
        "2026-05-16",
        "2026-05-17",
        "2026-05-18",
        "2026-05-22",
        "2026-05-23",
        "2026-05-24",
        "2026-05-25",
      ],
      visibleDates: ["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"],
    });
  });

  it("serializes stock ingredients for the active meal plan", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(listRecentManualShoppingItemsForFamily).mockResolvedValue([]);
    vi.mocked(getMealPlanShoppingData).mockResolvedValue({
      categories: [],
      family: {
        id: "family-1",
        name: "Solberg",
      },
      excludedGeneratedCount: 0,
      excludedGeneratedItems: [],
      familyStoreGroups: [],
      itemCounts: {
        family: 0,
        generated: 1,
        manual: 0,
        total: 1,
      },
      mealPlan: {
        activeShoppingDate: null,
        endDate: new Date("2026-05-18T00:00:00.000Z"),
        entries: [],
        id: "meal-plan-1",
        manualShoppingItems: [],
        shoppingOverrides: [],
        startDate: new Date("2026-05-15T00:00:00.000Z"),
        status: "DRAFT",
        title: "Uke 20",
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
      },
      projectedItems: [],
      stockIngredientCount: 1,
      stockIngredientsForPlan: [
        {
          category: {
            id: "category-pantry",
            name: "Torrvarer",
          },
          isOptedIn: false,
          name: "Salt",
          occurrenceCount: 1,
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
          quantityLabel: "1 ts",
          sourceKey: "entry-1:ingredient-1",
        },
      ],
      storeGroups: [],
      stores: [],
      userRole: "ADMIN",
      selectableShoppingDates: ["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"],
      visibleDates: ["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"],
    });

    const result = await loader({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(),
    });

    expect(result.stockIngredientCount).toBe(1);
    expect(result.stockIngredientsForPlan[0]?.name).toBe("Salt");
    expect(result.stockIngredientsForPlan[0]?.occurrences[0]?.date).toBe(
      "2026-05-15",
    );
  });

  it("opts stock ingredients into the shopping list", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(optInStockShoppingItems).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "opt-in-stock-shopping-item");
    formData.set("sourceKey", "entry-1:ingredient-1");

    const response = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/meal-plans/meal-plan-1/shopping",
        formData,
      ),
    });

    expect(optInStockShoppingItems).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKeys: ["entry-1:ingredient-1"],
      userId: "user-1",
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
  });

  it("returns quick-add success data without redirecting", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(createQuickManualShoppingItem).mockResolvedValue({
      item: {
        buyOnDate: null,
        category: { id: "category-other", name: "Annet" },
        checked: false,
        collaborationVersion: "2026-05-31T00:00:00.000Z",
        mealPlanId: "meal-plan-1",
        mealPlanTitle: "Langhelg",
        name: "Tannkrem",
        note: null,
        overrideVersion: "",
        preferredStore: null,
        quantity: "1",
        quantityLabel: "1",
        section: { displayName: "Annet", sortOrder: 99 },
        sourceKey: "manual-item-1",
        sourceType: "MANUAL",
      },
      recentManualItem: {
        categoryId: "category-other",
        displayName: "Tannkrem",
        nameNormalized: "tannkrem",
        quantity: "1",
      },
      status: "CREATED",
    });

    const formData = new FormData();
    formData.set("intent", "quick-add-manual-shopping-item");
    formData.set("name", "Tannkrem");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/meal-plans/meal-plan-1/shopping",
        formData,
      ),
    });

    expect(createQuickManualShoppingItem).toHaveBeenCalledWith({
      familyId: "family-1",
      input: {
        catalogItemId: "",
        ingredientId: "",
        name: "Tannkrem",
        quantity: "",
        recentNameNormalized: "",
      },
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(result).toEqual({
      intent: "quick-add-manual-shopping-item",
      item: {
        buyOnDate: null,
        category: { id: "category-other", name: "Annet" },
        checked: false,
        collaborationVersion: "2026-05-31T00:00:00.000Z",
        mealPlanId: "meal-plan-1",
        mealPlanTitle: "Langhelg",
        name: "Tannkrem",
        note: null,
        overrideVersion: "",
        preferredStore: null,
        quantity: "1",
        quantityLabel: "1",
        section: { displayName: "Annet", sortOrder: 99 },
        sourceKey: "manual-item-1",
        sourceType: "MANUAL",
      },
      ok: true,
      recentManualItem: {
        categoryId: "category-other",
        displayName: "Tannkrem",
        nameNormalized: "tannkrem",
        quantity: "1",
      },
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
      expectedUpdatedAt: "",
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
        postponedUntilDate: "Datoen må ligge innenfor ukeplanens aktive periode.",
      },
      status: "VALIDATION_ERROR",
      values: {
        note: "Kjøp senere",
        postponedUntilDate: "2026-05-21",
        preferredStoreId: "store-1",
        quantity: "",
      },
    });

    const formData = new FormData();
    formData.set("intent", "update-generated-shopping-item");
    formData.set("sourceKey", "entry-1:ingredient-1");
    formData.set("note", "Kjøp senere");
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
      expectedUpdatedAt: "",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "entry-1:ingredient-1",
      userId: "user-1",
      values: {
        note: "Kjøp senere",
        postponedUntilDate: "2026-05-21",
        preferredStoreId: "store-1",
        quantity: "",
      },
    });
    expect(result).toEqual({
      generatedOverrideFieldErrors: {
        postponedUntilDate: "Datoen må ligge innenfor ukeplanens aktive periode.",
      },
      intent: "update-generated-shopping-item",
      itemTarget: {
        sourceKey: "entry-1:ingredient-1",
        sourceType: "GENERATED",
      },
      overrideValues: {
        note: "Kjøp senere",
        postponedUntilDate: "2026-05-21",
        preferredStoreId: "store-1",
        quantity: "",
      },
    });
  });

  it("updates generated shopping item quantity without creating a manual item", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateGeneratedShoppingItemQuantity).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "update-generated-shopping-item-quantity");
    formData.set("sourceKey", "entry-1:ingredient-1");
    formData.set("expectedUpdatedAt", "2026-05-10T00:00:00.000Z");
    formData.set("quantity", "4 flasker");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/meal-plans/meal-plan-1/shopping",
        formData,
      ),
    });

    expect(updateGeneratedShoppingItemQuantity).toHaveBeenCalledWith({
      expectedUpdatedAt: "2026-05-10T00:00:00.000Z",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      quantity: "4 flasker",
      sourceKey: "entry-1:ingredient-1",
      userId: "user-1",
    });
    expect(result).toEqual({
      intent: "update-generated-shopping-item-quantity",
      ok: true,
    });
  });
});
