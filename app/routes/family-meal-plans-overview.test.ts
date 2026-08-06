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

vi.mock("../lib/meal-plan.server", () => {
  return {
    formatDateOnly: vi.fn((date: Date) => date.toISOString().slice(0, 10)),
    getDinnerAnalyticsForFamily: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { getDinnerAnalyticsForFamily } from "../lib/meal-plan.server";
import { loader } from "./family-meal-plans-overview";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(
  url = "http://localhost/families/family-1/meal-plans/overview",
) {
  return new Request(url);
}

describe("family meal plans overview route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads dinner analytics with default timeframe when query param is missing", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getDinnerAnalyticsForFamily).mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      latestRecipesUsed: [
        {
          date: new Date("2026-08-09T00:00:00.000Z"),
          recipeId: "recipe-1",
          recipeTitle: "Taco",
        },
      ],
      mostUsedIngredients: [
        {
          count: 4,
          ingredientName: "Tomat",
        },
      ],
      mostUsedRecipes: [
        {
          count: 2,
          recipeId: "recipe-1",
          recipeTitle: "Taco",
        },
      ],
      timeframe: "90d",
      timeframeStartDate: new Date("2026-05-11T00:00:00.000Z"),
    });

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(),
    });

    expect(getDinnerAnalyticsForFamily).toHaveBeenCalledWith({
      familyId: "family-1",
      timeframe: "90d",
      userId: "user-1",
    });
    expect(result).toEqual({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      latestRecipesUsed: [
        {
          date: "2026-08-09",
          recipeId: "recipe-1",
          recipeTitle: "Taco",
        },
      ],
      mostUsedIngredients: [
        {
          count: 4,
          ingredientName: "Tomat",
        },
      ],
      mostUsedRecipes: [
        {
          count: 2,
          recipeId: "recipe-1",
          recipeTitle: "Taco",
        },
      ],
      timeframe: "90d",
      timeframeStartDate: "2026-05-11",
    });
  });

  it("uses the explicit timeframe from query params", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getDinnerAnalyticsForFamily).mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      latestRecipesUsed: [],
      mostUsedIngredients: [],
      mostUsedRecipes: [],
      timeframe: "all",
      timeframeStartDate: null,
    });

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/meal-plans/overview?timeframe=all",
      ),
    });

    expect(getDinnerAnalyticsForFamily).toHaveBeenCalledWith({
      familyId: "family-1",
      timeframe: "all",
      userId: "user-1",
    });
    expect(result.timeframeStartDate).toBeNull();
  });
});
