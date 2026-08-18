import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/family.server", () => {
  return {
    requireFamilyMembership: vi.fn(),
  };
});

vi.mock("../lib/shopping-catalog.server", () => {
  return {
    searchShoppingQuickAddSuggestions: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { requireFamilyMembership } from "../lib/family.server";
import { searchShoppingQuickAddSuggestions } from "../lib/shopping-catalog.server";
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
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: { id: "family-1", name: "Solberg" },
      role: "MEMBER",
      userId: "user-1",
    } as never);

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: new Request(
        "http://localhost/families/family-1/meal-plans/meal-plan-1/shopping/ingredient-search?q=m",
      ),
    });

    expect(searchShoppingQuickAddSuggestions).not.toHaveBeenCalled();
    expect(result).toEqual({
      ingredientSearchResults: [],
    });
  });

  it("returns merged catalog and register matches for longer queries", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: { id: "family-1", name: "Solberg" },
      role: "MEMBER",
      userId: "user-1",
    } as never);
    vi.mocked(searchShoppingQuickAddSuggestions).mockResolvedValue([
      {
        canonicalName: "Tørkerull",
        defaultCategoryId: "category-other",
        defaultQuantity: "1 pk",
        id: "catalog-1",
        source: "catalog",
      },
      {
        canonicalName: "Melk",
        defaultCategoryId: "category-dairy",
        defaultQuantity: null,
        id: "ingredient-milk",
        source: "register",
      },
    ]);

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: new Request(
        "http://localhost/families/family-1/meal-plans/meal-plan-1/shopping/ingredient-search?q=melk",
      ),
    });

    expect(requireFamilyMembership).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(searchShoppingQuickAddSuggestions).toHaveBeenCalledWith({
      familyId: "family-1",
      query: "melk",
    });
    expect(result).toEqual({
      ingredientSearchResults: [
        {
          canonicalName: "Tørkerull",
          defaultCategoryId: "category-other",
          defaultQuantity: "1 pk",
          id: "catalog-1",
          source: "catalog",
        },
        {
          canonicalName: "Melk",
          defaultCategoryId: "category-dairy",
          defaultQuantity: null,
          id: "ingredient-milk",
          source: "register",
        },
      ],
    });
  });
});
