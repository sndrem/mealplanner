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

vi.mock("../lib/recipe.server", () => {
  return {
    getRecipeManagementData: vi.fn(),
  };
});

vi.mock("../lib/recipe-write.server", () => {
  return {
    createFamilyRecipe: vi.fn(),
    parseFamilyRecipeCoverInput: vi.fn(() => ({ file: null, remove: false })),
    parseFamilyRecipeValues: vi.fn(),
  };
});

vi.mock("../lib/r2.server", () => {
  return {
    isR2Configured: vi.fn(() => false),
  };
});

import { requireUser } from "../lib/auth.server";
import { getRecipeManagementData } from "../lib/recipe.server";
import {
  createFamilyRecipe,
  parseFamilyRecipeCoverInput,
  parseFamilyRecipeValues,
} from "../lib/recipe-write.server";
import { action, loader } from "./family-recipes";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(url = "http://localhost/families/family-1/recipes", formData?: FormData) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family recipes route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads family and global recipe lists", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getRecipeManagementData).mockResolvedValue({
      categories: [{ displayName: "Meieri", familyId: null, id: "category-dairy", key: "dairy" }],
      family: { id: "family-1", name: "Solberg" },
      familyRecipes: [
        {
          _count: { ingredients: 2, mealPlanEntries: 0 },
          defaultServings: 4,
          description: "Familie",
          familyId: "family-1",
          id: "recipe-family",
          imageUrl: null,
          prepMinutes: 20,
          scope: "FAMILY",
          tags: ["middag"],
          title: "Familiepai",
          updatedAt: new Date(),
        },
      ],
      familyStores: [],
      globalRecipes: [
        {
          _count: { ingredients: 3, mealPlanEntries: 1 },
          defaultServings: 4,
          description: "Global",
          familyId: null,
          id: "recipe-global",
          imageUrl: null,
          prepMinutes: 30,
          scope: "GLOBAL",
          tags: [],
          title: "Tomatsuppe",
          updatedAt: new Date(),
        },
      ],
      userRole: "ADMIN",
    });

    const result = await loader({
      params: { familyId: "family-1" },
      request: buildRequest(),
    });

    expect(getRecipeManagementData).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result.familyRecipes).toHaveLength(1);
    expect(result.globalRecipes).toHaveLength(1);
    expect(result.r2Configured).toBe(false);
  });

  it("passes cover input when creating a recipe", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(parseFamilyRecipeValues).mockReturnValue({
      defaultServings: "",
      description: "",
      ingredients: [
        {
          amount: "",
          categoryId: "category-dairy",
          displayName: "Melk",
          preferredStoreId: "",
          unit: "",
        },
      ],
      prepMinutes: "",
      reminderSuggestions: [],
      tags: "",
      title: "Familiepai",
    });
    vi.mocked(parseFamilyRecipeCoverInput).mockReturnValue({
      file: null,
      remove: false,
    });
    vi.mocked(createFamilyRecipe).mockResolvedValue({
      recipe: {
        id: "recipe-new",
        title: "Familiepai",
      },
      status: "CREATED",
    });

    const formData = new FormData();
    formData.set("intent", "create-recipe");

    await action({
      params: { familyId: "family-1" },
      request: buildRequest("http://localhost/families/family-1/recipes", formData),
    });

    expect(createFamilyRecipe).toHaveBeenCalledWith({
      cover: { file: null, remove: false },
      familyId: "family-1",
      userId: "user-1",
      values: expect.objectContaining({ title: "Familiepai" }),
    });
  });

  it("redirects to the recipe detail page after create", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(parseFamilyRecipeValues).mockReturnValue({
      defaultServings: "",
      description: "",
      ingredients: [
        {
          amount: "",
          categoryId: "category-dairy",
          displayName: "Melk",
          preferredStoreId: "",
          unit: "",
        },
      ],
      prepMinutes: "",
      reminderSuggestions: [],
      tags: "",
      title: "Familiepai",
    });
    vi.mocked(createFamilyRecipe).mockResolvedValue({
      recipe: {
        id: "recipe-new",
        title: "Familiepai",
      },
      status: "CREATED",
    });

    const formData = new FormData();
    formData.set("intent", "create-recipe");

    const response = await action({
      params: { familyId: "family-1" },
      request: buildRequest("http://localhost/families/family-1/recipes", formData),
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/recipes/recipe-new?notice=recipe-created",
    );
  });

  it("redirects to returnTo after create when provided", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(parseFamilyRecipeValues).mockReturnValue({
      defaultServings: "",
      description: "",
      ingredients: [
        {
          amount: "",
          categoryId: "category-dairy",
          displayName: "Melk",
          preferredStoreId: "",
          unit: "",
        },
      ],
      prepMinutes: "",
      reminderSuggestions: [],
      tags: "",
      title: "Familiepai",
    });
    vi.mocked(createFamilyRecipe).mockResolvedValue({
      recipe: {
        id: "recipe-new",
        title: "Familiepai",
      },
      status: "CREATED",
    });

    const formData = new FormData();
    formData.set("intent", "create-recipe");
    formData.set(
      "returnTo",
      "/families/family-1/meal-plans/meal-plan-1",
    );

    const response = await action({
      params: { familyId: "family-1" },
      request: buildRequest("http://localhost/families/family-1/recipes", formData),
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/meal-plans/meal-plan-1?notice=recipe-created",
    );
  });
});
