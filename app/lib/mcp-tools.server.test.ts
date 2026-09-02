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
  listMealPlansForFamilyMock,
  createOrReplaceMealPlanProposalMock,
  dbMock,
} = vi.hoisted(() => ({
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
  listMealPlansForFamilyMock: vi.fn(),
  createOrReplaceMealPlanProposalMock: vi.fn(),
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

import {
  createMealPlanProposalForMcp,
  getCurrentWeekMealPlanForMcp,
  getRecentDinnersForMcp,
  getRecipeForMcp,
  getShoppingListForMcp,
  listFreezerItemsForMcp,
  listMealPlansForMcp,
  listRecipesForMcp,
} from "./mcp-tools.server";

const actor = { familyId: "family-1", userId: "user-1" };

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
            category: { displayName: "Meieri", id: "cat-1" },
            displayName: "Ost",
            unit: "g",
          },
        ],
        prepMinutes: 15,
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
            displayName: "Ost",
            unit: "g",
          },
        ],
        prepMinutes: 15,
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
});
