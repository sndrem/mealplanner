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

vi.mock("../lib/shopping-catalog.server", () => {
  return {
    listFamilyShoppingCatalogItems: vi.fn(),
  };
});

vi.mock("../lib/shopping-catalog-write.server", () => {
  return {
    addFamilyShoppingCatalogItem: vi.fn(),
    deleteFamilyShoppingCatalogItem: vi.fn(),
    updateFamilyShoppingCatalogItem: vi.fn(),
  };
});

vi.mock("../lib/store.server", () => {
  return {
    listIngredientCategories: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { listFamilyShoppingCatalogItems } from "../lib/shopping-catalog.server";
import {
  addFamilyShoppingCatalogItem,
  deleteFamilyShoppingCatalogItem,
  updateFamilyShoppingCatalogItem,
} from "../lib/shopping-catalog-write.server";
import { listIngredientCategories } from "../lib/store.server";
import { action, loader } from "./family-shopping-catalog";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(
  url = "http://localhost/families/family-1/shopping-catalog",
  formData?: FormData,
) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family shopping catalog route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads family catalog items and categories", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(listFamilyShoppingCatalogItems).mockResolvedValue({
      catalogItems: [
        {
          defaultCategory: {
            displayName: "Annet",
            id: "category-other",
          },
          defaultCategoryId: "category-other",
          defaultQuantity: "1 pk",
          displayName: "Tørkerull",
          id: "catalog-1",
          lastUsedAt: new Date("2026-08-18T00:00:00.000Z"),
          nameNormalized: "tørkerull",
        },
      ],
      family: {
        id: "family-1",
        name: "Solberg",
      },
      userRole: "MEMBER",
    });
    vi.mocked(listIngredientCategories).mockResolvedValue([
      { displayName: "Annet", familyId: null, id: "category-other", key: "other" },
    ]);

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(),
    });

    expect(result.catalogItems).toHaveLength(1);
    expect(result.categories).toHaveLength(1);
    expect(result.userRole).toBe("MEMBER");
  });

  it("adds a catalog item", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(addFamilyShoppingCatalogItem).mockResolvedValue({
      catalogItemId: "catalog-1",
      status: "CREATED",
    });

    const formData = new FormData();
    formData.set("intent", "add-catalog-item");
    formData.set("name", "Tørkerull");
    formData.set("quantity", "1 pk");
    formData.set("categoryId", "category-other");

    const response = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/shopping-catalog",
        formData,
      ),
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect(addFamilyShoppingCatalogItem).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
      values: {
        categoryId: "category-other",
        name: "Tørkerull",
        quantity: "1 pk",
      },
    });
  });

  it("updates a catalog item", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateFamilyShoppingCatalogItem).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "update-catalog-item");
    formData.set("catalogItemId", "catalog-1");
    formData.set("name", "Tørkerull XL");
    formData.set("quantity", "2 pk");
    formData.set("categoryId", "category-other");

    const response = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/shopping-catalog",
        formData,
      ),
    });

    expect(response).toBeInstanceOf(Response);
    expect(updateFamilyShoppingCatalogItem).toHaveBeenCalledWith({
      catalogItemId: "catalog-1",
      familyId: "family-1",
      userId: "user-1",
      values: {
        categoryId: "category-other",
        name: "Tørkerull XL",
        quantity: "2 pk",
      },
    });
  });

  it("removes a catalog item", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(deleteFamilyShoppingCatalogItem).mockResolvedValue({
      status: "DELETED",
    });

    const formData = new FormData();
    formData.set("intent", "remove-catalog-item");
    formData.set("catalogItemId", "catalog-1");

    const response = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/shopping-catalog",
        formData,
      ),
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect(deleteFamilyShoppingCatalogItem).toHaveBeenCalledWith({
      catalogItemId: "catalog-1",
      familyId: "family-1",
      userId: "user-1",
    });
  });
});
