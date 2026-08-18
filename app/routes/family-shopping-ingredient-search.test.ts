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
import { loader } from "./family-shopping-ingredient-search";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

describe("family shopping ingredient search route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requires family membership and returns merged suggestions", async () => {
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
    ]);

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: new Request(
        "http://localhost/families/family-1/shopping/ingredient-search?q=tørk",
      ),
    });

    expect(requireFamilyMembership).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(searchShoppingQuickAddSuggestions).toHaveBeenCalledWith({
      familyId: "family-1",
      query: "tørk",
    });
    expect(result.ingredientSearchResults).toHaveLength(1);
  });
});
