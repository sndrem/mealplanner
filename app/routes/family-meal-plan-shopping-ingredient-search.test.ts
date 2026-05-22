import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/stock.server", () => {
  return {
    searchCanonicalIngredients: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { searchCanonicalIngredients } from "../lib/stock.server";
import { loader } from "./family-meal-plan-shopping-ingredient-search";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

describe("family meal plan shopping ingredient search route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty list for short queries", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);

    const result = await loader({
      request: new Request(
        "http://localhost/families/family-1/meal-plans/meal-plan-1/shopping/ingredient-search?q=m",
      ),
    });

    expect(searchCanonicalIngredients).not.toHaveBeenCalled();
    expect(result).toEqual({
      ingredientSearchResults: [],
    });
  });

  it("returns canonical ingredient matches for longer queries", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(searchCanonicalIngredients).mockResolvedValue([
      {
        canonicalName: "Melk",
        defaultCategoryId: "category-dairy",
        id: "ingredient-milk",
      },
    ]);

    const result = await loader({
      request: new Request(
        "http://localhost/families/family-1/meal-plans/meal-plan-1/shopping/ingredient-search?q=melk",
      ),
    });

    expect(searchCanonicalIngredients).toHaveBeenCalledWith("melk");
    expect(result).toEqual({
      ingredientSearchResults: [
        {
          canonicalName: "Melk",
          defaultCategoryId: "category-dairy",
          id: "ingredient-milk",
        },
      ],
    });
  });
});
