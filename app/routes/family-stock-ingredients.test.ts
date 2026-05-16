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

vi.mock("../lib/stock.server", () => {
  return {
    listFamilyStockIngredients: vi.fn(),
    searchCanonicalIngredients: vi.fn(),
  };
});

vi.mock("../lib/stock-write.server", () => {
  return {
    addFamilyStockIngredient: vi.fn(),
    removeFamilyStockIngredient: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { listFamilyStockIngredients, searchCanonicalIngredients } from "../lib/stock.server";
import {
  addFamilyStockIngredient,
  removeFamilyStockIngredient,
} from "../lib/stock-write.server";
import { action, loader } from "./family-stock-ingredients";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(
  url = "http://localhost/families/family-1/stock-ingredients",
  formData?: FormData,
) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family stock ingredients route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads family stock ingredients", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(listFamilyStockIngredients).mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      stockIngredients: [
        {
          displayLabel: "salt",
          displayNameNormalized: null,
          id: "stock-1",
          ingredientId: "ingredient-salt",
          note: null,
        },
      ],
      userRole: "ADMIN",
    });
    vi.mocked(searchCanonicalIngredients).mockResolvedValue([]);

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(),
    });

    expect(result.stockIngredients).toHaveLength(1);
    expect(result.userRole).toBe("ADMIN");
  });

  it("adds a stock ingredient for admins", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(addFamilyStockIngredient).mockResolvedValue({
      status: "CREATED",
      stockIngredientId: "stock-1",
    });

    const formData = new FormData();
    formData.set("intent", "add-stock-ingredient");
    formData.set("ingredientId", "ingredient-salt");
    formData.set("displayName", "");
    formData.set("note", "");

    const response = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/stock-ingredients",
        formData,
      ),
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect(addFamilyStockIngredient).toHaveBeenCalled();
  });

  it("removes a stock ingredient", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(removeFamilyStockIngredient).mockResolvedValue({
      status: "DELETED",
    });

    const formData = new FormData();
    formData.set("intent", "remove-stock-ingredient");
    formData.set("stockIngredientId", "stock-1");

    const response = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/stock-ingredients",
        formData,
      ),
    });

    expect(response).toBeInstanceOf(Response);
    expect(removeFamilyStockIngredient).toHaveBeenCalledWith({
      familyId: "family-1",
      stockIngredientId: "stock-1",
      userId: "user-1",
    });
  });
});
