import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/meal-plan-for-date.server", () => ({
  resolveStoreModeAnchorMealPlan: vi.fn(),
}));

vi.mock("../lib/shopping.server", () => {
  return {
    getFamilyStoreModeData: vi.fn(),
    listRecentManualShoppingItemsForFamily: vi.fn(),
    projectCreatedFamilyShoppingItem: vi.fn(),
    projectCreatedManualShoppingItem: vi.fn(),
  };
});

vi.mock("../lib/family-shopping-write.server", () => {
  return {
    createQuickFamilyShoppingItem: vi.fn(),
    parseFamilyShoppingItemValues: vi.fn(),
    parseQuickAddFamilyShoppingItemInput: vi.fn(),
    toggleFamilyShoppingItemChecked: vi.fn(),
    updateFamilyShoppingItem: vi.fn(),
    updateFamilyShoppingItemQuantity: vi.fn(),
  };
});

vi.mock("../lib/shopping-write.server", () => {
  return {
    parseManualShoppingItemValues: vi.fn(),
    toggleShoppingItemChecked: vi.fn(),
    updateActiveShoppingDate: vi.fn(),
    updateManualShoppingItem: vi.fn(),
  };
});

vi.mock("../lib/store.server", () => {
  return {
    listIngredientCategories: vi.fn(),
  };
});

vi.mock("../lib/store-write.server", () => {
  return {
    updateSelectedStorePreference: vi.fn(),
  };
});

import {
  createQuickFamilyShoppingItem,
  parseFamilyShoppingItemValues,
  parseQuickAddFamilyShoppingItemInput,
  updateFamilyShoppingItem,
  updateFamilyShoppingItemQuantity,
} from "../lib/family-shopping-write.server";
import { requireUser } from "../lib/auth.server";
import { resolveStoreModeAnchorMealPlan } from "../lib/meal-plan-for-date.server";
import {
  getFamilyStoreModeData,
  listRecentManualShoppingItemsForFamily,
  projectCreatedFamilyShoppingItem,
  projectCreatedManualShoppingItem,
} from "../lib/shopping.server";
import {
  parseManualShoppingItemValues,
  toggleShoppingItemChecked,
  updateActiveShoppingDate,
  updateManualShoppingItem,
} from "../lib/shopping-write.server";
import { listIngredientCategories } from "../lib/store.server";
import { updateSelectedStorePreference } from "../lib/store-write.server";
import { action, loader } from "./family-meal-plan-store-mode";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(
  url = "http://localhost/families/family-1/store-mode",
  formData?: FormData,
) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family store mode route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads and serializes store mode data", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(listIngredientCategories).mockResolvedValue([
      {
        displayName: "Meieri",
        id: "category-dairy",
      },
    ]);
    vi.mocked(listRecentManualShoppingItemsForFamily).mockResolvedValue([
      {
        categoryId: "",
        displayName: "Melk",
        nameNormalized: "melk",
        quantity: "",
      },
    ]);
    vi.mocked(getFamilyStoreModeData).mockResolvedValue({
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
              mealPlanId: "meal-plan-1",
              mealPlanTitle: "Langhelg",
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
      includedMealPlans: [
        {
          id: "meal-plan-1",
          status: "DRAFT",
          title: "Langhelg",
        },
      ],
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
      selectableShoppingDates: [
        "2026-05-15",
        "2026-05-16",
        "2026-05-17",
        "2026-05-18",
        "2026-05-22",
        "2026-05-23",
      ],
      visibleDates: ["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"],
    });

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(),
    } as never);

    expect(getFamilyStoreModeData).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(listRecentManualShoppingItemsForFamily).toHaveBeenCalledWith({
      familyId: "family-1",
    });
    expect(listIngredientCategories).toHaveBeenCalled();
    expect(result.categories).toEqual([
      {
        displayName: "Meieri",
        id: "category-dairy",
      },
    ]);
    expect(result.recentManualItems).toEqual([
      {
        categoryId: "",
        displayName: "Melk",
        nameNormalized: "melk",
        quantity: "",
      },
    ]);
    expect(result.activeShoppingDate).toBe("2026-05-16");
    expect(result.selectableShoppingDates).toEqual([
      "2026-05-15",
      "2026-05-16",
      "2026-05-17",
      "2026-05-18",
      "2026-05-22",
      "2026-05-23",
    ]);
    expect(result.mealPlan.activeShoppingDate).toBe("2026-05-16");
    expect(result.includedMealPlans).toEqual([
      {
        id: "meal-plan-1",
        status: "DRAFT",
        title: "Langhelg",
      },
    ]);
    expect(result.dueSectionGroups[0]?.items[0]).toEqual(
      expect.objectContaining({
        firstDate: "2026-05-15",
        lastDate: "2026-05-15",
        mealPlanId: "meal-plan-1",
        mealPlanTitle: "Langhelg",
        name: "Paprika",
      }),
    );
  });

  it("redirects to meal plans when the family has none", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getFamilyStoreModeData).mockResolvedValue(null);

    try {
      await loader({
        params: {
          familyId: "family-1",
        },
        request: buildRequest(),
      } as never);
      expect.fail("Expected redirect");
    } catch (response) {
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe(
        "/families/family-1/meal-plans",
      );
    }
  });

  it("returns active shopping date validation errors from the server module", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
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
    formData.set("mealPlanId", "meal-plan-1");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(undefined, formData),
    } as never);

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

  it("returns quick-add success data without redirecting", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
    vi.mocked(parseQuickAddFamilyShoppingItemInput).mockReturnValue({
      ingredientId: "ingredient-1",
      name: "Melk",
      quantity: "",
      recentNameNormalized: "",
    });
    vi.mocked(createQuickFamilyShoppingItem).mockResolvedValue({
      item: {
        category: { id: "category-dairy", name: "Meieri" },
        checked: false,
        collaborationVersion: "2026-05-31T00:00:00.000Z",
        mealPlanId: null,
        mealPlanTitle: null,
        name: "Melk",
        note: null,
        preferredStore: null,
        quantity: "1",
        quantityLabel: "1",
        section: { displayName: "Meieri", sortOrder: 1 },
        sourceKey: "family-item-1",
        sourceType: "FAMILY",
      },
      recentManualItem: {
        categoryId: "category-dairy",
        displayName: "Melk",
        nameNormalized: "melk",
        quantity: "1",
      },
      status: "CREATED",
    });

    const formData = new FormData();
    formData.set("intent", "quick-add-family-shopping-item");
    formData.set("name", "Melk");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(undefined, formData),
    } as never);

    expect(createQuickFamilyShoppingItem).toHaveBeenCalledWith({
      familyId: "family-1",
      input: {
        ingredientId: "ingredient-1",
        name: "Melk",
        quantity: "",
        recentNameNormalized: "",
      },
      userId: "user-1",
    });
    expect(result).toEqual({
      intent: "quick-add-family-shopping-item",
      item: {
        category: { id: "category-dairy", name: "Meieri" },
        checked: false,
        collaborationVersion: "2026-05-31T00:00:00.000Z",
        mealPlanId: null,
        mealPlanTitle: null,
        name: "Melk",
        note: null,
        preferredStore: null,
        quantity: "1",
        quantityLabel: "1",
        section: { displayName: "Meieri", sortOrder: 1 },
        sourceKey: "family-item-1",
        sourceType: "FAMILY",
      },
      ok: true,
      recentManualItem: {
        categoryId: "category-dairy",
        displayName: "Melk",
        nameNormalized: "melk",
        quantity: "1",
      },
    });
  });

  it("returns quick-add validation errors without redirecting", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
    vi.mocked(parseQuickAddFamilyShoppingItemInput).mockReturnValue({
      ingredientId: "",
      name: "",
      quantity: "",
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
      },
      request: buildRequest(undefined, formData),
    } as never);

    expect(result).toEqual({
      formError: "Kunne ikke legge til varen.",
      intent: "quick-add-family-shopping-item",
    });
  });

  it("updates family item quantity without redirecting", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
    vi.mocked(updateFamilyShoppingItemQuantity).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "update-family-shopping-item-quantity");
    formData.set("sourceKey", "family-item-1");
    formData.set("expectedUpdatedAt", "2026-05-10T00:00:00.000Z");
    formData.set("quantity", "4 flasker");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(undefined, formData),
    } as never);

    expect(updateFamilyShoppingItemQuantity).toHaveBeenCalledWith({
      expectedUpdatedAt: "2026-05-10T00:00:00.000Z",
      familyId: "family-1",
      familyItemId: "family-item-1",
      quantity: "4 flasker",
      userId: "user-1",
    });
    expect(result).toEqual({
      intent: "update-family-shopping-item-quantity",
      ok: true,
    });
  });

  it("updates family item category without redirecting", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
    vi.mocked(parseFamilyShoppingItemValues).mockReturnValue({
      categoryId: "category-produce",
      name: "Bananer",
      note: "",
      preferredStoreId: "",
      quantity: "1",
    });
    vi.mocked(updateFamilyShoppingItem).mockResolvedValue({
      status: "UPDATED",
    });
    vi.mocked(projectCreatedFamilyShoppingItem).mockResolvedValue({
      category: { id: "category-produce", name: "Frukt og gront" },
      checked: false,
      collaborationVersion: "2026-05-31T00:00:00.000Z",
      mealPlanId: null,
      mealPlanTitle: null,
      name: "Bananer",
      note: null,
      preferredStore: null,
      quantity: "1",
      quantityLabel: "1",
      section: { displayName: "Frukt og gront", sortOrder: 1 },
      sourceKey: "family-item-1",
      sourceType: "FAMILY",
    });

    const formData = new FormData();
    formData.set("intent", "update-family-shopping-item-category");
    formData.set("sourceKey", "family-item-1");
    formData.set("expectedUpdatedAt", "2026-05-10T00:00:00.000Z");
    formData.set("categoryId", "category-produce");
    formData.set("name", "Bananer");
    formData.set("note", "");
    formData.set("preferredStoreId", "");
    formData.set("quantity", "1");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(undefined, formData),
    } as never);

    expect(updateFamilyShoppingItem).toHaveBeenCalledWith({
      expectedUpdatedAt: "2026-05-10T00:00:00.000Z",
      familyId: "family-1",
      familyItemId: "family-item-1",
      userId: "user-1",
      values: {
        categoryId: "category-produce",
        name: "Bananer",
        note: "",
        preferredStoreId: "",
        quantity: "1",
      },
    });
    expect(projectCreatedFamilyShoppingItem).toHaveBeenCalledWith({
      familyId: "family-1",
      familyItemId: "family-item-1",
    });
    expect(result).toEqual({
      intent: "update-family-shopping-item-category",
      item: {
        category: { id: "category-produce", name: "Frukt og gront" },
        checked: false,
        collaborationVersion: "2026-05-31T00:00:00.000Z",
        mealPlanId: null,
        mealPlanTitle: null,
        name: "Bananer",
        note: null,
        preferredStore: null,
        quantity: "1",
        quantityLabel: "1",
        section: { displayName: "Frukt og gront", sortOrder: 1 },
        sourceKey: "family-item-1",
        sourceType: "FAMILY",
      },
      ok: true,
    });
  });

  it("updates manual item category without redirecting", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
    vi.mocked(parseManualShoppingItemValues).mockReturnValue({
      buyOnDate: "",
      categoryId: "category-produce",
      name: "Bananer",
      note: "",
      preferredStoreId: "",
      quantity: "2 kg",
    });
    vi.mocked(updateManualShoppingItem).mockResolvedValue({
      status: "UPDATED",
    });
    vi.mocked(projectCreatedManualShoppingItem).mockResolvedValue({
      buyOnDate: null,
      category: { id: "category-produce", name: "Frukt og gront" },
      checked: false,
      collaborationVersion: "2026-05-31T00:00:00.000Z",
      mealPlanId: "meal-plan-2",
      mealPlanTitle: "Neste uke",
      name: "Bananer",
      note: null,
      overrideVersion: "",
      preferredStore: null,
      quantity: "2 kg",
      quantityLabel: "2 kg",
      section: { displayName: "Frukt og gront", sortOrder: 1 },
      sourceKey: "manual-item-1",
      sourceType: "MANUAL",
    });

    const formData = new FormData();
    formData.set("intent", "update-manual-shopping-item-category");
    formData.set("sourceKey", "manual-item-1");
    formData.set("expectedUpdatedAt", "2026-05-10T00:00:00.000Z");
    formData.set("categoryId", "category-produce");
    formData.set("name", "Bananer");
    formData.set("note", "");
    formData.set("preferredStoreId", "");
    formData.set("quantity", "2 kg");
    formData.set("buyOnDate", "");
    formData.set("itemMealPlanId", "meal-plan-2");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(undefined, formData),
    } as never);

    expect(updateManualShoppingItem).toHaveBeenCalledWith({
      expectedUpdatedAt: "2026-05-10T00:00:00.000Z",
      familyId: "family-1",
      manualItemId: "manual-item-1",
      mealPlanId: "meal-plan-2",
      userId: "user-1",
      values: {
        buyOnDate: "",
        categoryId: "category-produce",
        name: "Bananer",
        note: "",
        preferredStoreId: "",
        quantity: "2 kg",
      },
    });
    expect(result).toEqual({
      intent: "update-manual-shopping-item-category",
      item: {
        buyOnDate: null,
        category: { id: "category-produce", name: "Frukt og gront" },
        checked: false,
        collaborationVersion: "2026-05-31T00:00:00.000Z",
        mealPlanId: "meal-plan-2",
        mealPlanTitle: "Neste uke",
        name: "Bananer",
        note: null,
        overrideVersion: "",
        preferredStore: null,
        quantity: "2 kg",
        quantityLabel: "2 kg",
        section: { displayName: "Frukt og gront", sortOrder: 1 },
        sourceKey: "manual-item-1",
        sourceType: "MANUAL",
      },
      ok: true,
    });
  });

  it("persists a note on manual item category update", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
    vi.mocked(parseManualShoppingItemValues).mockReturnValue({
      buyOnDate: "",
      categoryId: "category-dairy",
      name: "Melk",
      note: "Tine lettmelk",
      preferredStoreId: "",
      quantity: "1",
    });
    vi.mocked(updateManualShoppingItem).mockResolvedValue({
      status: "UPDATED",
    });
    vi.mocked(projectCreatedManualShoppingItem).mockResolvedValue({
      buyOnDate: null,
      category: { id: "category-dairy", name: "Meieri" },
      checked: false,
      collaborationVersion: "2026-05-31T00:00:00.000Z",
      mealPlanId: "meal-plan-2",
      mealPlanTitle: "Neste uke",
      name: "Melk",
      note: "Tine lettmelk",
      overrideVersion: "",
      preferredStore: null,
      quantity: "1",
      quantityLabel: "1",
      section: { displayName: "Meieri", sortOrder: 1 },
      sourceKey: "manual-item-1",
      sourceType: "MANUAL",
    });

    const formData = new FormData();
    formData.set("intent", "update-manual-shopping-item-category");
    formData.set("sourceKey", "manual-item-1");
    formData.set("expectedUpdatedAt", "2026-05-10T00:00:00.000Z");
    formData.set("categoryId", "category-dairy");
    formData.set("name", "Melk");
    formData.set("note", "Tine lettmelk");
    formData.set("preferredStoreId", "");
    formData.set("quantity", "1");
    formData.set("buyOnDate", "");
    formData.set("itemMealPlanId", "meal-plan-2");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(undefined, formData),
    } as never);

    expect(updateManualShoppingItem).toHaveBeenCalledWith({
      expectedUpdatedAt: "2026-05-10T00:00:00.000Z",
      familyId: "family-1",
      manualItemId: "manual-item-1",
      mealPlanId: "meal-plan-2",
      userId: "user-1",
      values: {
        buyOnDate: "",
        categoryId: "category-dairy",
        name: "Melk",
        note: "Tine lettmelk",
        preferredStoreId: "",
        quantity: "1",
      },
    });
    expect(result).toEqual({
      intent: "update-manual-shopping-item-category",
      item: {
        buyOnDate: null,
        category: { id: "category-dairy", name: "Meieri" },
        checked: false,
        collaborationVersion: "2026-05-31T00:00:00.000Z",
        mealPlanId: "meal-plan-2",
        mealPlanTitle: "Neste uke",
        name: "Melk",
        note: "Tine lettmelk",
        overrideVersion: "",
        preferredStore: null,
        quantity: "1",
        quantityLabel: "1",
        section: { displayName: "Meieri", sortOrder: 1 },
        sourceKey: "manual-item-1",
        sourceType: "MANUAL",
      },
      ok: true,
    });
  });

  it("clears a note on manual item category update", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
    vi.mocked(parseManualShoppingItemValues).mockReturnValue({
      buyOnDate: "",
      categoryId: "category-dairy",
      name: "Melk",
      note: "",
      preferredStoreId: "",
      quantity: "1",
    });
    vi.mocked(updateManualShoppingItem).mockResolvedValue({
      status: "UPDATED",
    });
    vi.mocked(projectCreatedManualShoppingItem).mockResolvedValue({
      buyOnDate: null,
      category: { id: "category-dairy", name: "Meieri" },
      checked: false,
      collaborationVersion: "2026-05-31T00:00:00.000Z",
      mealPlanId: "meal-plan-2",
      mealPlanTitle: "Neste uke",
      name: "Melk",
      note: null,
      overrideVersion: "",
      preferredStore: null,
      quantity: "1",
      quantityLabel: "1",
      section: { displayName: "Meieri", sortOrder: 1 },
      sourceKey: "manual-item-1",
      sourceType: "MANUAL",
    });

    const formData = new FormData();
    formData.set("intent", "update-manual-shopping-item-category");
    formData.set("sourceKey", "manual-item-1");
    formData.set("expectedUpdatedAt", "2026-05-10T00:00:00.000Z");
    formData.set("categoryId", "category-dairy");
    formData.set("name", "Melk");
    formData.set("note", "");
    formData.set("preferredStoreId", "");
    formData.set("quantity", "1");
    formData.set("buyOnDate", "");
    formData.set("itemMealPlanId", "meal-plan-2");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(undefined, formData),
    } as never);

    expect(updateManualShoppingItem).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          note: "",
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        intent: "update-manual-shopping-item-category",
        item: expect.objectContaining({
          note: null,
        }),
        ok: true,
      }),
    );
  });

  it("preserves an existing note when changing manual item category", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
    vi.mocked(parseManualShoppingItemValues).mockReturnValue({
      buyOnDate: "",
      categoryId: "category-produce",
      name: "Melk",
      note: "Tine lettmelk",
      preferredStoreId: "",
      quantity: "1",
    });
    vi.mocked(updateManualShoppingItem).mockResolvedValue({
      status: "UPDATED",
    });
    vi.mocked(projectCreatedManualShoppingItem).mockResolvedValue({
      buyOnDate: null,
      category: { id: "category-produce", name: "Frukt og gront" },
      checked: false,
      collaborationVersion: "2026-05-31T00:00:00.000Z",
      mealPlanId: "meal-plan-2",
      mealPlanTitle: "Neste uke",
      name: "Melk",
      note: "Tine lettmelk",
      overrideVersion: "",
      preferredStore: null,
      quantity: "1",
      quantityLabel: "1",
      section: { displayName: "Frukt og gront", sortOrder: 1 },
      sourceKey: "manual-item-1",
      sourceType: "MANUAL",
    });

    const formData = new FormData();
    formData.set("intent", "update-manual-shopping-item-category");
    formData.set("sourceKey", "manual-item-1");
    formData.set("expectedUpdatedAt", "2026-05-10T00:00:00.000Z");
    formData.set("categoryId", "category-produce");
    formData.set("name", "Melk");
    formData.set("note", "Tine lettmelk");
    formData.set("preferredStoreId", "");
    formData.set("quantity", "1");
    formData.set("buyOnDate", "");
    formData.set("itemMealPlanId", "meal-plan-2");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(undefined, formData),
    } as never);

    expect(updateManualShoppingItem).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          categoryId: "category-produce",
          note: "Tine lettmelk",
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        item: expect.objectContaining({
          category: expect.objectContaining({ id: "category-produce" }),
          note: "Tine lettmelk",
        }),
        ok: true,
      }),
    );
  });

  it("persists a note on family item category update", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
    vi.mocked(parseFamilyShoppingItemValues).mockReturnValue({
      categoryId: "category-dairy",
      name: "Melk",
      note: "Helmelk",
      preferredStoreId: "",
      quantity: "1",
    });
    vi.mocked(updateFamilyShoppingItem).mockResolvedValue({
      status: "UPDATED",
    });
    vi.mocked(projectCreatedFamilyShoppingItem).mockResolvedValue({
      category: { id: "category-dairy", name: "Meieri" },
      checked: false,
      collaborationVersion: "2026-05-31T00:00:00.000Z",
      mealPlanId: null,
      mealPlanTitle: null,
      name: "Melk",
      note: "Helmelk",
      preferredStore: null,
      quantity: "1",
      quantityLabel: "1",
      section: { displayName: "Meieri", sortOrder: 1 },
      sourceKey: "family-item-1",
      sourceType: "FAMILY",
    });

    const formData = new FormData();
    formData.set("intent", "update-family-shopping-item-category");
    formData.set("sourceKey", "family-item-1");
    formData.set("expectedUpdatedAt", "2026-05-10T00:00:00.000Z");
    formData.set("categoryId", "category-dairy");
    formData.set("name", "Melk");
    formData.set("note", "Helmelk");
    formData.set("preferredStoreId", "");
    formData.set("quantity", "1");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(undefined, formData),
    } as never);

    expect(updateFamilyShoppingItem).toHaveBeenCalledWith({
      expectedUpdatedAt: "2026-05-10T00:00:00.000Z",
      familyId: "family-1",
      familyItemId: "family-item-1",
      userId: "user-1",
      values: {
        categoryId: "category-dairy",
        name: "Melk",
        note: "Helmelk",
        preferredStoreId: "",
        quantity: "1",
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        intent: "update-family-shopping-item-category",
        item: expect.objectContaining({
          note: "Helmelk",
        }),
        ok: true,
      }),
    );
  });

  it("uses itemMealPlanId when toggling meal-plan shopping items", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
    vi.mocked(toggleShoppingItemChecked).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "toggle-shopping-item-checked");
    formData.set("sourceKey", "entry-2:ingredient-2");
    formData.set("sourceType", "GENERATED");
    formData.set("checked", "true");
    formData.set("expectedUpdatedAt", "2026-05-10T00:00:00.000Z");
    formData.set("itemMealPlanId", "meal-plan-2");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(undefined, formData),
    } as never);

    expect(toggleShoppingItemChecked).toHaveBeenCalledWith({
      checked: true,
      expectedUpdatedAt: "2026-05-10T00:00:00.000Z",
      familyId: "family-1",
      mealPlanId: "meal-plan-2",
      sourceKey: "entry-2:ingredient-2",
      sourceType: "GENERATED",
      userId: "user-1",
    });
    expect(result).toEqual({
      intent: "toggle-shopping-item-checked",
      ok: true,
    });
  });

  it("redirects after updating the selected store", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(resolveStoreModeAnchorMealPlan).mockResolvedValue({
      id: "meal-plan-1",
    });
    vi.mocked(updateSelectedStorePreference).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "update-selected-store");
    formData.set("selectedStoreId", "store-2");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(undefined, formData),
    } as never);

    expect(updateSelectedStorePreference).toHaveBeenCalledWith({
      familyId: "family-1",
      selectedStoreId: "store-2",
      userId: "user-1",
    });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/store-mode?notice=selected-store-updated",
    );
    expect(toggleShoppingItemChecked).not.toHaveBeenCalled();
  });
});
