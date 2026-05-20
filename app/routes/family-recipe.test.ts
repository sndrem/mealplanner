import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>(
    "../lib/auth.server",
  );

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/recipe.server", () => {
  return {
    getFamilyRecipeDetail: vi.fn(),
    getRecipeManagementData: vi.fn(),
  };
});

vi.mock("../lib/recipe-write.server", () => {
  return {
    deleteFamilyRecipe: vi.fn(),
    parseFamilyRecipeValues: vi.fn(),
    updateFamilyRecipe: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { getFamilyRecipeDetail, getRecipeManagementData } from "../lib/recipe.server";
import {
  deleteFamilyRecipe,
  parseFamilyRecipeValues,
  updateFamilyRecipe,
} from "../lib/recipe-write.server";
import { action } from "./family-recipe";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(
  url = "http://localhost/families/family-1/recipes/recipe-1",
  formData?: FormData,
) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family recipe route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getRecipeManagementData).mockResolvedValue({
      categories: [],
      family: { id: "family-1", name: "Solberg" },
      familyRecipes: [],
      familyStores: [],
      globalRecipes: [],
      userRole: "ADMIN",
    });
    vi.mocked(getFamilyRecipeDetail).mockResolvedValue({
      categories: [],
      familyStores: [],
      mealPlanEntryCount: 1,
      recipe: {
        createdAt: new Date(),
        defaultServings: 4,
        description: "Test",
        familyId: "family-1",
        id: "recipe-1",
        ingredients: [],
        prepMinutes: 20,
        scope: "FAMILY",
        tags: [],
        title: "Test",
        updatedAt: new Date(),
      },
      status: "FOUND",
    });
  });

  it("returns a visible error when delete is blocked by meal plan usage", async () => {
    vi.mocked(deleteFamilyRecipe).mockResolvedValue({
      entryCount: 2,
      status: "IN_USE",
      title: "Test",
    });

    const formData = new FormData();
    formData.set("intent", "delete-recipe");
    formData.set("recipeId", "recipe-1");

    const result = await action({
      params: { familyId: "family-1", recipeId: "recipe-1" },
      request: buildRequest(undefined, formData),
    });

    expect(result).toEqual({
      formError:
        "«Test» brukes i 2 ukeplaner og kan ikke slettes før du fjerner den fra planene.",
      intent: "delete-recipe",
    });
  });

  it("redirects to the recipe list after delete", async () => {
    vi.mocked(deleteFamilyRecipe).mockResolvedValue({
      status: "DELETED",
    });

    const formData = new FormData();
    formData.set("intent", "delete-recipe");
    formData.set("recipeId", "recipe-1");

    const response = await action({
      params: { familyId: "family-1", recipeId: "recipe-1" },
      request: buildRequest(undefined, formData),
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/recipes?notice=recipe-deleted",
    );
  });

  it("returns validation errors from update", async () => {
    vi.mocked(parseFamilyRecipeValues).mockReturnValue({
      defaultServings: "",
      description: "",
      ingredients: [],
      prepMinutes: "",
      tags: "",
      title: "",
    });
    vi.mocked(updateFamilyRecipe).mockResolvedValue({
      fieldErrors: {
        title: "Skriv inn en tittel.",
      },
      status: "VALIDATION_ERROR",
      values: {
        defaultServings: "",
        description: "",
        ingredients: [],
        prepMinutes: "",
        tags: "",
        title: "",
      },
    });

    const formData = new FormData();
    formData.set("intent", "update-recipe");
    formData.set("recipeId", "recipe-1");

    const result = await action({
      params: { familyId: "family-1", recipeId: "recipe-1" },
      request: buildRequest(undefined, formData),
    });

    expect(result).toEqual({
      intent: "update-recipe",
      updateFieldErrors: {
        title: "Skriv inn en tittel.",
      },
      updateValues: {
        defaultServings: "",
        description: "",
        ingredients: [],
        prepMinutes: "",
        tags: "",
        title: "",
      },
    });
  });
});
