import { afterEach, describe, expect, it, vi } from "vitest";

const {
  findMealPlanCoveringDateMock,
  getAccessibleRecipeDetailMock,
  getCalendarWeekBoundsMock,
  getCalendarWeekDatesMock,
  getFamilyShoppingDataMock,
  getMealPlanPlanningDataMock,
  getRecentlyUsedRecipeIdsMock,
  getRecipeManagementDataMock,
  listFamilyFreezerItemsMock,
  listIngredientCategoriesMock,
  listMealPlansForFamilyMock,
  createFamilyRecipeMock,
  createOrReplaceMealPlanProposalMock,
  updateFamilyRecipeMock,
  dbMock,
} = vi.hoisted(() => ({
  createFamilyRecipeMock: vi.fn(),
  createOrReplaceMealPlanProposalMock: vi.fn(),
  dbMock: {
    recipe: {
      findMany: vi.fn(),
    },
  },
  findMealPlanCoveringDateMock: vi.fn(),
  getAccessibleRecipeDetailMock: vi.fn(),
  getCalendarWeekBoundsMock: vi.fn(),
  getCalendarWeekDatesMock: vi.fn(),
  getFamilyShoppingDataMock: vi.fn(),
  getMealPlanPlanningDataMock: vi.fn(),
  getRecentlyUsedRecipeIdsMock: vi.fn(),
  getRecipeManagementDataMock: vi.fn(),
  listFamilyFreezerItemsMock: vi.fn(),
  listIngredientCategoriesMock: vi.fn(),
  listMealPlansForFamilyMock: vi.fn(),
  updateFamilyRecipeMock: vi.fn(),
}));

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./recipe.server", () => ({
  getAccessibleRecipeDetail: getAccessibleRecipeDetailMock,
  getRecipeManagementData: getRecipeManagementDataMock,
}));

vi.mock("./meal-plan-for-date.server", () => ({
  findMealPlanCoveringDate: findMealPlanCoveringDateMock,
}));

vi.mock("./meal-plan.server", () => ({
  createOrReplaceMealPlanProposal: createOrReplaceMealPlanProposalMock,
  getMealPlanPlanningData: getMealPlanPlanningDataMock,
  getRecentlyUsedRecipeIds: getRecentlyUsedRecipeIdsMock,
  listMealPlansForFamily: listMealPlansForFamilyMock,
}));

vi.mock("./meal-plan-week", () => ({
  getCalendarWeekBounds: getCalendarWeekBoundsMock,
  getCalendarWeekDates: getCalendarWeekDatesMock,
}));

vi.mock("./shopping.server", () => ({
  getFamilyShoppingData: getFamilyShoppingDataMock,
}));

vi.mock("./freezer.server", () => ({
  listFamilyFreezerItems: listFamilyFreezerItemsMock,
}));

vi.mock("./store.server", () => ({
  listIngredientCategories: listIngredientCategoriesMock,
}));

vi.mock("./recipe-write.server", () => ({
  createFamilyRecipe: createFamilyRecipeMock,
  updateFamilyRecipe: updateFamilyRecipeMock,
}));

import {
  createMealPlanProposalForMcp,
  getCurrentWeekMealPlanForMcp,
  getRecentDinnersForMcp,
  getRecipeForMcp,
  getShoppingListForMcp,
  listFreezerItemsForMcp,
  listIngredientCategoriesForMcp,
  listMealPlansForMcp,
  listRecipesForMcp,
  upsertRecipeForMcp,
} from "./mcp-tools.server";

const actor = { familyId: "family-1", userId: "user-1" };

const familyRecipeDetail = {
  defaultServings: 4,
  description: "En god middag",
  familyId: "family-1",
  id: "recipe-1",
  imageUrl: null,
  ingredients: [
    {
      amount: "500",
      category: { displayName: "Kjøtt og fisk", id: "cat-meat", key: "meat-fish" },
      categoryId: "cat-meat",
      displayName: "Kyllingfilet",
      preferredStoreId: "store-1",
      unit: "g",
    },
  ],
  prepMinutes: 30,
  reminderSuggestions: [
    {
      note: "Ta ut kvelden før",
      timingKind: "HOURS_BEFORE_16",
      title: "Ta deigen ut",
    },
  ],
  scope: "FAMILY" as const,
  tags: ["middag"],
  title: "Kyllingwok",
};

const serializedFamilyRecipe = {
  defaultServings: 4,
  description: "En god middag",
  id: "recipe-1",
  imageUrl: null,
  ingredients: [
    {
      amount: "500",
      category: "Kjøtt og fisk",
      categoryId: "cat-meat",
      categoryKey: "meat-fish",
      displayName: "Kyllingfilet",
      preferredStoreId: "store-1",
      unit: "g",
    },
  ],
  prepMinutes: 30,
  reminderSuggestions: [
    {
      note: "Ta ut kvelden før",
      timingKind: "HOURS_BEFORE_16",
      title: "Ta deigen ut",
    },
  ],
  scope: "FAMILY",
  tags: ["middag"],
  title: "Kyllingwok",
};

describe("mcp-tools.server", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("flattens family and global recipes including missing images", async () => {
    getRecipeManagementDataMock.mockResolvedValue({
      familyRecipes: [
        {
          defaultServings: 4,
          description: null,
          id: "family-recipe",
          imageUrl: null,
          prepMinutes: 20,
          scope: "FAMILY",
          tags: ["middag"],
          title: "Taco",
        },
      ],
      globalRecipes: [
        {
          defaultServings: 2,
          description: "En global rett",
          id: "global-recipe",
          imageUrl: "https://images.example.com/pizza.jpg",
          prepMinutes: null,
          scope: "GLOBAL",
          tags: [],
          title: "Pizza",
        },
      ],
    });

    await expect(listRecipesForMcp(actor)).resolves.toEqual({
      recipes: [
        {
          defaultServings: 4,
          description: null,
          id: "family-recipe",
          imageUrl: null,
          prepMinutes: 20,
          scope: "FAMILY",
          tags: ["middag"],
          title: "Taco",
        },
        {
          defaultServings: 2,
          description: "En global rett",
          id: "global-recipe",
          imageUrl: "https://images.example.com/pizza.jpg",
          prepMinutes: null,
          scope: "GLOBAL",
          tags: [],
          title: "Pizza",
        },
      ],
    });
  });

  it("returns a global recipe detail", async () => {
    getAccessibleRecipeDetailMock.mockResolvedValue({
      recipe: {
        defaultServings: 2,
        description: "En global rett",
        familyId: null,
        id: "global-recipe",
        imageUrl: "https://images.example.com/pizza.jpg",
        ingredients: [
          {
            amount: "200",
            category: { displayName: "Meieri", id: "cat-1", key: "dairy" },
            categoryId: "cat-1",
            displayName: "Ost",
            preferredStoreId: null,
            unit: "g",
          },
        ],
        prepMinutes: 15,
        reminderSuggestions: [],
        scope: "GLOBAL",
        tags: [],
        title: "Pizza",
      },
      status: "FOUND",
    });

    await expect(
      getRecipeForMcp({ ...actor, recipeId: "global-recipe" }),
    ).resolves.toEqual({
      recipe: {
        defaultServings: 2,
        description: "En global rett",
        id: "global-recipe",
        imageUrl: "https://images.example.com/pizza.jpg",
        ingredients: [
          {
            amount: "200",
            category: "Meieri",
            categoryId: "cat-1",
            categoryKey: "dairy",
            displayName: "Ost",
            preferredStoreId: null,
            unit: "g",
          },
        ],
        prepMinutes: 15,
        reminderSuggestions: [],
        scope: "GLOBAL",
        tags: [],
        title: "Pizza",
      },
    });
  });

  it("returns null when a recipe is not accessible", async () => {
    getAccessibleRecipeDetailMock.mockResolvedValue({
      status: "NOT_FOUND",
    });

    await expect(
      getRecipeForMcp({ ...actor, recipeId: "missing" }),
    ).resolves.toBeNull();
  });

  it("returns empty dinners when no meal plan covers this week", async () => {
    getCalendarWeekBoundsMock.mockReturnValue({
      weekEnd: "2026-09-06",
      weekStart: "2026-08-31",
    });
    getCalendarWeekDatesMock.mockReturnValue(["2026-08-31", "2026-09-01"]);
    findMealPlanCoveringDateMock.mockResolvedValue(null);

    await expect(getCurrentWeekMealPlanForMcp(actor)).resolves.toEqual({
      dinners: [
        {
          date: "2026-08-31",
          description: null,
          freezerLabel: null,
          imageUrl: null,
          note: null,
          recipeId: null,
          title: null,
        },
        {
          date: "2026-09-01",
          description: null,
          freezerLabel: null,
          imageUrl: null,
          note: null,
          recipeId: null,
          title: null,
        },
      ],
      mealPlan: null,
      weekEnd: "2026-09-06",
      weekStart: "2026-08-31",
    });
    expect(getMealPlanPlanningDataMock).not.toHaveBeenCalled();
  });

  it("maps dinner entries from the covering meal plan", async () => {
    getCalendarWeekBoundsMock.mockReturnValue({
      weekEnd: "2026-09-06",
      weekStart: "2026-08-31",
    });
    getCalendarWeekDatesMock.mockReturnValue(["2026-08-31", "2026-09-01"]);
    findMealPlanCoveringDateMock.mockResolvedValue({
      endDate: new Date("2026-09-06T00:00:00.000Z"),
      id: "plan-1",
      startDate: new Date("2026-08-31T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 36",
    });
    getMealPlanPlanningDataMock.mockResolvedValue({
      mealPlan: {
        endDate: new Date("2026-09-06T00:00:00.000Z"),
        entries: [
          {
            date: new Date("2026-08-31T00:00:00.000Z"),
            freezerItem: null,
            mealType: "DINNER",
            note: null,
            recipe: {
              description: "Taco-kveld",
              imageUrl: "https://images.example.com/taco.jpg",
              title: "Taco",
            },
            recipeId: "recipe-taco",
          },
          {
            date: new Date("2026-08-31T00:00:00.000Z"),
            freezerItem: null,
            mealType: "LUNCH",
            note: "skip",
            recipe: {
              description: null,
              imageUrl: null,
              title: "Lunsj",
            },
            recipeId: "recipe-lunch",
          },
        ],
        id: "plan-1",
        startDate: new Date("2026-08-31T00:00:00.000Z"),
        status: "DRAFT",
        title: "Uke 36",
      },
    });

    await expect(getCurrentWeekMealPlanForMcp(actor)).resolves.toEqual({
      dinners: [
        {
          date: "2026-08-31",
          description: "Taco-kveld",
          freezerLabel: null,
          imageUrl: "https://images.example.com/taco.jpg",
          note: null,
          recipeId: "recipe-taco",
          title: "Taco",
        },
        {
          date: "2026-09-01",
          description: null,
          freezerLabel: null,
          imageUrl: null,
          note: null,
          recipeId: null,
          title: null,
        },
      ],
      mealPlan: {
        endDate: "2026-09-06",
        id: "plan-1",
        startDate: "2026-08-31",
        status: "DRAFT",
        title: "Uke 36",
      },
      weekEnd: "2026-09-06",
      weekStart: "2026-08-31",
    });
  });

  it("lists meal plan summaries", async () => {
    listMealPlansForFamilyMock.mockResolvedValue({
      mealPlans: [
        {
          endDate: new Date("2026-09-06T00:00:00.000Z"),
          id: "plan-1",
          startDate: new Date("2026-08-31T00:00:00.000Z"),
          status: "DRAFT",
          title: "Uke 36",
        },
      ],
    });

    await expect(listMealPlansForMcp(actor)).resolves.toEqual({
      mealPlans: [
        {
          endDate: "2026-09-06",
          id: "plan-1",
          startDate: "2026-08-31",
          status: "DRAFT",
          title: "Uke 36",
        },
      ],
    });
  });

  it("maps shopping list items", async () => {
    getFamilyShoppingDataMock.mockResolvedValue({
      activeListMode: "COMBINED",
      itemCounts: {
        checked: 1,
        family: 1,
        mealPlan: 1,
        total: 2,
        unchecked: 1,
      },
      projectedItems: [
        {
          category: { id: "cat-1", name: "Meieri" },
          checked: false,
          name: "Melk",
          preferredStore: { id: "store-1", name: "Kiwi" },
          quantityLabel: "1 l",
          sourceType: "FAMILY",
        },
        {
          category: { id: "cat-2", name: "Annet" },
          checked: true,
          name: "Tortilla",
          preferredStore: null,
          quantityLabel: null,
          sourceType: "GENERATED",
        },
      ],
    });

    await expect(getShoppingListForMcp(actor)).resolves.toEqual({
      activeListMode: "COMBINED",
      itemCounts: {
        checked: 1,
        family: 1,
        mealPlan: 1,
        total: 2,
        unchecked: 1,
      },
      items: [
        {
          category: "Meieri",
          checked: false,
          name: "Melk",
          quantity: "1 l",
          sourceType: "FAMILY",
          store: "Kiwi",
        },
        {
          category: "Annet",
          checked: true,
          name: "Tortilla",
          quantity: null,
          sourceType: "GENERATED",
          store: null,
        },
      ],
    });
  });

  it("returns recent dinner recipe ids and titles", async () => {
    findMealPlanCoveringDateMock.mockResolvedValue({
      id: "plan-1",
      startDate: new Date("2026-08-31T00:00:00.000Z"),
    });
    getRecentlyUsedRecipeIdsMock.mockResolvedValue(new Set(["recipe-1"]));
    dbMock.recipe.findMany.mockResolvedValue([
      { id: "recipe-1", title: "Taco" },
    ]);

    await expect(getRecentDinnersForMcp(actor)).resolves.toEqual({
      recipes: [{ id: "recipe-1", title: "Taco" }],
    });
    expect(getRecentlyUsedRecipeIdsMock).toHaveBeenCalledWith({
      beforeDate: new Date("2026-08-31T00:00:00.000Z"),
      currentMealPlanId: "plan-1",
      familyId: "family-1",
    });
  });

  it("lists freezer items", async () => {
    listFamilyFreezerItemsMock.mockResolvedValue({
      freezerItems: [{ id: "fz-1", label: "Lasagne", note: null, quantity: 1 }],
    });

    await expect(listFreezerItemsForMcp(actor)).resolves.toEqual({
      freezerItems: [{ id: "fz-1", label: "Lasagne", note: null, quantity: 1 }],
    });
  });

  it("creates a meal plan proposal and returns a proposal URL", async () => {
    createOrReplaceMealPlanProposalMock.mockResolvedValue({
      dinners: [
        {
          date: "2026-05-18",
          freezerItemId: null,
          freezerLabel: null,
          note: null,
          recipeId: "recipe-taco",
          title: "Taco",
        },
      ],
      proposalId: "proposal-1",
      status: "CREATED",
      title: "Uke 21",
      weekEnd: "2026-05-24",
      weekStart: "2026-05-18",
    });

    await expect(
      createMealPlanProposalForMcp({
        ...actor,
        dinners: [{ date: "2026-05-18", recipeId: "recipe-taco" }],
        origin: "https://mealplanner.example",
      }),
    ).resolves.toEqual({
      dinners: [
        {
          date: "2026-05-18",
          freezerItemId: null,
          freezerLabel: null,
          note: null,
          recipeId: "recipe-taco",
          title: "Taco",
        },
      ],
      proposalId: "proposal-1",
      proposalUrl:
        "https://mealplanner.example/families/family-1/meal-plans/proposal-1/proposal",
      status: "CREATED",
      title: "Uke 21",
      weekEnd: "2026-05-24",
      weekStart: "2026-05-18",
    });
  });

  it("returns proposal validation errors without a URL", async () => {
    createOrReplaceMealPlanProposalMock.mockResolvedValue({
      formError: "Det finnes allerede en ukeplan for denne uken.",
      status: "LIVE_PLAN_EXISTS",
    });

    await expect(
      createMealPlanProposalForMcp({
        ...actor,
        dinners: [],
        origin: "https://mealplanner.example",
      }),
    ).resolves.toEqual({
      formError: "Det finnes allerede en ukeplan for denne uken.",
      status: "LIVE_PLAN_EXISTS",
    });
  });

  it("lists ingredient categories with keys", async () => {
    listIngredientCategoriesMock.mockResolvedValue([
      {
        displayName: "Kjøtt og fisk",
        familyId: null,
        id: "cat-meat",
        key: "meat-fish",
      },
    ]);

    await expect(listIngredientCategoriesForMcp()).resolves.toEqual({
      categories: [
        {
          displayName: "Kjøtt og fisk",
          id: "cat-meat",
          key: "meat-fish",
        },
      ],
    });
  });

  it("creates a family recipe through createFamilyRecipe", async () => {
    listIngredientCategoriesMock.mockResolvedValue([
      {
        displayName: "Kjøtt og fisk",
        familyId: null,
        id: "cat-meat",
        key: "meat-fish",
      },
    ]);
    createFamilyRecipeMock.mockResolvedValue({
      recipe: { id: "recipe-1", title: "Kyllingwok" },
      status: "CREATED",
    });
    getAccessibleRecipeDetailMock.mockResolvedValue({
      recipe: familyRecipeDetail,
      status: "FOUND",
    });

    await expect(
      upsertRecipeForMcp({
        ...actor,
        ingredients: [
          {
            amount: "500",
            categoryKey: "meat-fish",
            displayName: "Kyllingfilet",
            preferredStoreId: "store-1",
            unit: "g",
          },
        ],
        origin: "https://mealplanner.example",
        tags: ["middag"],
        title: "Kyllingwok",
      }),
    ).resolves.toEqual({
      action: "created",
      recipe: serializedFamilyRecipe,
      recipeId: "recipe-1",
      recipeUrl:
        "https://mealplanner.example/families/family-1/recipes/recipe-1",
      status: "CREATED",
      title: "Kyllingwok",
    });
    expect(createFamilyRecipeMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
      values: {
        defaultServings: "",
        description: "",
        ingredients: [
          {
            amount: "500",
            categoryId: "cat-meat",
            displayName: "Kyllingfilet",
            preferredStoreId: "store-1",
            unit: "g",
          },
        ],
        prepMinutes: "",
        reminderSuggestions: [],
        tags: "middag",
        title: "Kyllingwok",
      },
    });
    expect(updateFamilyRecipeMock).not.toHaveBeenCalled();
  });

  it("rejects unknown ingredient categories without writing", async () => {
    listIngredientCategoriesMock.mockResolvedValue([
      {
        displayName: "Kjøtt og fisk",
        familyId: null,
        id: "cat-meat",
        key: "meat-fish",
      },
    ]);

    await expect(
      upsertRecipeForMcp({
        ...actor,
        ingredients: [
          {
            categoryKey: "unknown",
            displayName: "Kyllingfilet",
          },
        ],
        origin: "https://mealplanner.example",
        title: "Kyllingwok",
      }),
    ).resolves.toEqual({
      formError: "Ingrediens 1: Ukjent kategorinøkkel: unknown",
      status: "VALIDATION_ERROR",
    });
    expect(createFamilyRecipeMock).not.toHaveBeenCalled();
  });

  it("does not update a global recipe", async () => {
    getAccessibleRecipeDetailMock.mockResolvedValue({
      recipe: {
        ...familyRecipeDetail,
        familyId: null,
        id: "global-recipe",
        scope: "GLOBAL",
      },
      status: "FOUND",
    });

    await expect(
      upsertRecipeForMcp({
        ...actor,
        origin: "https://mealplanner.example",
        recipeId: "global-recipe",
        tags: ["middag"],
      }),
    ).resolves.toEqual({
      formError: "Fant ikke oppskriften.",
      status: "NOT_FOUND",
    });
    expect(updateFamilyRecipeMock).not.toHaveBeenCalled();
  });

  it("does not write when the recipe id is missing", async () => {
    getAccessibleRecipeDetailMock.mockResolvedValue({
      status: "NOT_FOUND",
    });

    await expect(
      upsertRecipeForMcp({
        ...actor,
        origin: "https://mealplanner.example",
        recipeId: "missing",
        tags: ["middag"],
      }),
    ).resolves.toEqual({
      formError: "Fant ikke oppskriften.",
      status: "NOT_FOUND",
    });
    expect(updateFamilyRecipeMock).not.toHaveBeenCalled();
  });

  it("merges a tags-only update onto the stored recipe", async () => {
    getAccessibleRecipeDetailMock
      .mockResolvedValueOnce({
        recipe: familyRecipeDetail,
        status: "FOUND",
      })
      .mockResolvedValueOnce({
        recipe: {
          ...familyRecipeDetail,
          tags: ["middag", "rask", "kylling"],
        },
        status: "FOUND",
      });
    updateFamilyRecipeMock.mockResolvedValue({ status: "UPDATED" });

    await expect(
      upsertRecipeForMcp({
        ...actor,
        origin: "https://mealplanner.example",
        recipeId: "recipe-1",
        tags: ["middag", "rask", "kylling"],
      }),
    ).resolves.toEqual({
      action: "updated",
      recipe: {
        ...serializedFamilyRecipe,
        tags: ["middag", "rask", "kylling"],
      },
      recipeId: "recipe-1",
      recipeUrl:
        "https://mealplanner.example/families/family-1/recipes/recipe-1",
      status: "UPDATED",
      title: "Kyllingwok",
    });
    expect(updateFamilyRecipeMock).toHaveBeenCalledWith({
      familyId: "family-1",
      recipeId: "recipe-1",
      userId: "user-1",
      values: {
        defaultServings: "4",
        description: "En god middag",
        ingredients: [
          {
            amount: "500",
            categoryId: "cat-meat",
            displayName: "Kyllingfilet",
            preferredStoreId: "store-1",
            unit: "g",
          },
        ],
        prepMinutes: "30",
        reminderSuggestions: [
          {
            note: "Ta ut kvelden før",
            timingKind: "HOURS_BEFORE_16",
            title: "Ta deigen ut",
          },
        ],
        tags: "middag, rask, kylling",
        title: "Kyllingwok",
      },
    });
    expect(createFamilyRecipeMock).not.toHaveBeenCalled();
  });

  it("merges a description-only update without changing tags", async () => {
    getAccessibleRecipeDetailMock
      .mockResolvedValueOnce({
        recipe: familyRecipeDetail,
        status: "FOUND",
      })
      .mockResolvedValueOnce({
        recipe: {
          ...familyRecipeDetail,
          description: "Ny beskrivelse",
        },
        status: "FOUND",
      });
    updateFamilyRecipeMock.mockResolvedValue({ status: "UPDATED" });

    await expect(
      upsertRecipeForMcp({
        ...actor,
        description: "Ny beskrivelse",
        origin: "https://mealplanner.example",
        recipeId: "recipe-1",
      }),
    ).resolves.toMatchObject({
      action: "updated",
      recipe: { description: "Ny beskrivelse", tags: ["middag"] },
      status: "UPDATED",
    });
    expect(updateFamilyRecipeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          description: "Ny beskrivelse",
          tags: "middag",
          title: "Kyllingwok",
        }),
      }),
    );
  });

  it("replaces ingredients on update when they are sent", async () => {
    listIngredientCategoriesMock.mockResolvedValue([
      {
        displayName: "Meieri",
        familyId: null,
        id: "cat-dairy",
        key: "dairy",
      },
    ]);
    getAccessibleRecipeDetailMock
      .mockResolvedValueOnce({
        recipe: familyRecipeDetail,
        status: "FOUND",
      })
      .mockResolvedValueOnce({
        recipe: {
          ...familyRecipeDetail,
          ingredients: [
            {
              amount: "200",
              category: { displayName: "Meieri", id: "cat-dairy", key: "dairy" },
              categoryId: "cat-dairy",
              displayName: "Ost",
              preferredStoreId: null,
              unit: "g",
            },
          ],
        },
        status: "FOUND",
      });
    updateFamilyRecipeMock.mockResolvedValue({ status: "UPDATED" });

    await expect(
      upsertRecipeForMcp({
        ...actor,
        ingredients: [
          {
            amount: "200",
            category: "Meieri",
            displayName: "Ost",
            unit: "g",
          },
        ],
        origin: "https://mealplanner.example",
        recipeId: "recipe-1",
      }),
    ).resolves.toMatchObject({
      action: "updated",
      status: "UPDATED",
    });
    expect(updateFamilyRecipeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          ingredients: [
            {
              amount: "200",
              categoryId: "cat-dairy",
              displayName: "Ost",
              preferredStoreId: "",
              unit: "g",
            },
          ],
          title: "Kyllingwok",
        }),
      }),
    );
  });

  it("applies a full-field update", async () => {
    listIngredientCategoriesMock.mockResolvedValue([
      {
        displayName: "Kjøtt og fisk",
        familyId: null,
        id: "cat-meat",
        key: "meat-fish",
      },
    ]);
    getAccessibleRecipeDetailMock
      .mockResolvedValueOnce({
        recipe: familyRecipeDetail,
        status: "FOUND",
      })
      .mockResolvedValueOnce({
        recipe: {
          ...familyRecipeDetail,
          defaultServings: 6,
          description: "Oppdatert",
          prepMinutes: 40,
          tags: ["middag", "wok"],
          title: "Wok",
        },
        status: "FOUND",
      });
    updateFamilyRecipeMock.mockResolvedValue({ status: "UPDATED" });

    await expect(
      upsertRecipeForMcp({
        ...actor,
        defaultServings: 6,
        description: "Oppdatert",
        ingredients: [
          {
            amount: "500",
            categoryKey: "meat-fish",
            displayName: "Kyllingfilet",
            unit: "g",
          },
        ],
        origin: "https://mealplanner.example",
        prepMinutes: 40,
        recipeId: "recipe-1",
        reminderSuggestions: [
          { timingKind: "MORNING_OF", title: "Sett ovnen på" },
        ],
        tags: ["middag", "wok"],
        title: "Wok",
      }),
    ).resolves.toMatchObject({
      action: "updated",
      recipe: { title: "Wok" },
      status: "UPDATED",
    });
    expect(updateFamilyRecipeMock).toHaveBeenCalledWith({
      familyId: "family-1",
      recipeId: "recipe-1",
      userId: "user-1",
      values: {
        defaultServings: "6",
        description: "Oppdatert",
        ingredients: [
          {
            amount: "500",
            categoryId: "cat-meat",
            displayName: "Kyllingfilet",
            preferredStoreId: "",
            unit: "g",
          },
        ],
        prepMinutes: "40",
        reminderSuggestions: [
          {
            note: "",
            timingKind: "MORNING_OF",
            title: "Sett ovnen på",
          },
        ],
        tags: "middag, wok",
        title: "Wok",
      },
    });
  });
});
