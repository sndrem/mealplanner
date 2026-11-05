import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const { mockAuthWithRequireUser } = await import("../test/mock-require-user");

  return mockAuthWithRequireUser();
});

vi.mock("../lib/family.server", () => ({
  requireFamilyMembership: vi.fn(),
}));

vi.mock("../lib/shopping-note.server", () => ({
  interpretShoppingNote: vi.fn(),
  listShoppingNoteCategories: vi.fn(),
}));

vi.mock("../lib/shopping-write.server", () => ({
  resolveQuickAddManualShoppingItemValues: vi.fn(),
}));

vi.mock("../lib/family-shopping-write.server", () => ({
  createFamilyShoppingItem: vi.fn(),
}));

vi.mock("../lib/shopping.server", () => ({
  projectCreatedFamilyShoppingItem: vi.fn(),
}));

vi.mock("../lib/shopping-catalog-write.server", () => ({
  upsertFamilyShoppingCatalogItemFromQuickAdd: vi.fn(),
}));

import { requireUser } from "../lib/auth.server";
import { createFamilyShoppingItem } from "../lib/family-shopping-write.server";
import { requireFamilyMembership } from "../lib/family.server";
import { upsertFamilyShoppingCatalogItemFromQuickAdd } from "../lib/shopping-catalog-write.server";
import {
  interpretShoppingNote,
  listShoppingNoteCategories,
} from "../lib/shopping-note.server";
import { projectCreatedFamilyShoppingItem } from "../lib/shopping.server";
import { resolveQuickAddManualShoppingItemValues } from "../lib/shopping-write.server";
import { action, loader } from "./family-shopping-paste";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

const categories = [
  { displayName: "Annet", id: "cat-other" },
  { displayName: "Meieri", id: "cat-dairy" },
];

const projectedItem = {
  category: { id: "cat-dairy", name: "Meieri" },
  checked: false,
  collaborationVersion: "2026-11-05T00:00:00.000Z",
  mealPlanId: null,
  mealPlanTitle: null,
  name: "Melk",
  note: null,
  preferredStore: null,
  quantity: "2 liter",
  quantityLabel: "2 liter",
  section: { displayName: "Meieri", sortOrder: 1 },
  sourceKey: "family-item-1",
  sourceType: "FAMILY" as const,
};

describe("family shopping paste route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the family name and categories for a member", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: { id: "family-1", joinCode: "ABC123", name: "Solberg" },
      familyId: "family-1",
      id: "membership-1",
      role: "MEMBER",
      userId: "user-1",
    });
    vi.mocked(listShoppingNoteCategories).mockResolvedValue(categories);

    const result = await loader({
      params: { familyId: "family-1" },
      request: new Request("http://localhost/families/family-1/shopping/paste"),
    });

    expect(result).toEqual({
      categories,
      family: { id: "family-1", name: "Solberg" },
    });
  });

  it("returns the model category and resolved name without creating items", async () => {
    mockMember();
    vi.mocked(interpretShoppingNote).mockResolvedValue({
      items: [{ categoryId: "cat-dairy", name: "melk", quantity: "2 liter" }],
      ok: true,
    });
    vi.mocked(resolveQuickAddManualShoppingItemValues).mockResolvedValue({
      ok: true,
      resolvedIngredientId: "ingredient-1",
      values: {
        buyOnDate: "",
        categoryId: "cat-other",
        name: "Melk",
        note: "",
        preferredStoreId: "",
        quantity: "1",
      },
    });

    const result = await action({
      params: { familyId: "family-1" },
      request: post({
        intent: "interpret-shopping-note",
        note: "2 liter melk",
      }),
    });

    expect(interpretShoppingNote).toHaveBeenCalledWith({
      categories,
      note: "2 liter melk",
    });
    expect(result).toEqual({
      intent: "interpret-shopping-note",
      items: [
        {
          categoryId: "cat-dairy",
          name: "Melk",
          quantity: "2 liter",
          resolvedIngredientId: "ingredient-1",
          resolvedName: "Melk",
        },
      ],
      ok: true,
    });
    expect(createFamilyShoppingItem).not.toHaveBeenCalled();
  });

  it("falls back to the resolver category when the model category is not allowed", async () => {
    mockMember();
    vi.mocked(interpretShoppingNote).mockResolvedValue({
      items: [{ categoryId: null, name: "melk", quantity: null }],
      ok: true,
    });
    vi.mocked(resolveQuickAddManualShoppingItemValues).mockResolvedValue({
      ok: true,
      values: {
        buyOnDate: "",
        categoryId: "cat-other",
        name: "Melk",
        note: "",
        preferredStoreId: "",
        quantity: "1",
      },
    });

    const result = await action({
      params: { familyId: "family-1" },
      request: post({
        intent: "interpret-shopping-note",
        note: "melk",
      }),
    });

    expect(result).toMatchObject({
      items: [expect.objectContaining({ categoryId: "cat-other", quantity: null })],
      ok: true,
    });
    expect(createFamilyShoppingItem).not.toHaveBeenCalled();
  });

  it("returns an interpret error and writes nothing when the model fails", async () => {
    mockMember();
    vi.mocked(interpretShoppingNote).mockResolvedValue({
      error: "Fant ingen varer i notatet.",
      ok: false,
    });

    const result = await action({
      params: { familyId: "family-1" },
      request: post({
        intent: "interpret-shopping-note",
        note: "hei",
      }),
    });

    expect(result).toEqual({
      formError: "Fant ingen varer i notatet.",
      intent: "interpret-shopping-note",
    });
    expect(resolveQuickAddManualShoppingItemValues).not.toHaveBeenCalled();
    expect(createFamilyShoppingItem).not.toHaveBeenCalled();
  });

  it("creates one item per reviewed row with the posted category and redirects", async () => {
    mockMember();
    vi.mocked(createFamilyShoppingItem).mockResolvedValue({
      familyItemId: "family-item-1",
      status: "CREATED",
    });
    vi.mocked(projectCreatedFamilyShoppingItem).mockResolvedValue(projectedItem);

    const response = await action({
      params: { familyId: "family-1" },
      request: post({
        intent: "confirm-shopping-note",
        items: JSON.stringify([
          {
            categoryId: "cat-other",
            name: "Melk",
            quantity: "2 liter",
            resolvedIngredientId: "ingredient-1",
            resolvedName: "Melk",
          },
          {
            categoryId: "cat-dairy",
            name: "Kulturmelk",
            quantity: null,
            resolvedIngredientId: "ingredient-1",
            resolvedName: "Melk",
          },
        ]),
      }),
    });

    expect(createFamilyShoppingItem).toHaveBeenNthCalledWith(1, {
      familyId: "family-1",
      userId: "user-1",
      values: {
        categoryId: "cat-other",
        name: "Melk",
        note: "",
        preferredStoreId: "",
        quantity: "2 liter",
      },
    });
    expect(createFamilyShoppingItem).toHaveBeenNthCalledWith(2, {
      familyId: "family-1",
      userId: "user-1",
      values: {
        categoryId: "cat-dairy",
        name: "Kulturmelk",
        note: "",
        preferredStoreId: "",
        quantity: "1",
      },
    });
    expect(upsertFamilyShoppingCatalogItemFromQuickAdd).toHaveBeenNthCalledWith(1, {
      familyId: "family-1",
      ingredientId: "ingredient-1",
      item: projectedItem,
    });
    expect(upsertFamilyShoppingCatalogItemFromQuickAdd).toHaveBeenNthCalledWith(2, {
      familyId: "family-1",
      ingredientId: undefined,
      item: projectedItem,
    });
    expect(resolveQuickAddManualShoppingItemValues).not.toHaveBeenCalled();
    expect(interpretShoppingNote).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "/families/family-1/store-mode?notice=shopping-note-items-added",
    );
  });

  it("writes nothing when the review has no rows or a blank category", async () => {
    mockMember();

    const empty = await action({
      params: { familyId: "family-1" },
      request: post({
        intent: "confirm-shopping-note",
        items: "[]",
      }),
    });
    const blankCategory = await action({
      params: { familyId: "family-1" },
      request: post({
        intent: "confirm-shopping-note",
        items: JSON.stringify([
          {
            categoryId: "",
            name: "Melk",
            quantity: null,
            resolvedIngredientId: null,
            resolvedName: "Melk",
          },
        ]),
      }),
    });

    expect(empty).toEqual({
      formError: "Legg til minst én vare.",
      intent: "confirm-shopping-note",
    });
    expect(blankCategory).toMatchObject({
      formError: "Velg en kategori på hver vare.",
      intent: "confirm-shopping-note",
    });
    expect(createFamilyShoppingItem).not.toHaveBeenCalled();
    expect(interpretShoppingNote).not.toHaveBeenCalled();
  });

  it("does not interpret or write for a non-member", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockRejectedValue(
      new Response("Fant ikke familien.", { status: 404 }),
    );

    await expect(
      action({
        params: { familyId: "family-2" },
        request: post({
          intent: "interpret-shopping-note",
          note: "melk",
        }),
      }),
    ).rejects.toBeInstanceOf(Response);
    expect(interpretShoppingNote).not.toHaveBeenCalled();
    expect(createFamilyShoppingItem).not.toHaveBeenCalled();
  });
});

function mockMember() {
  vi.mocked(requireUser).mockResolvedValue(mockUser);
  vi.mocked(requireFamilyMembership).mockResolvedValue({
    family: { id: "family-1", joinCode: "ABC123", name: "Solberg" },
    familyId: "family-1",
    id: "membership-1",
    role: "MEMBER",
    userId: "user-1",
  });
  vi.mocked(listShoppingNoteCategories).mockResolvedValue(categories);
}

function post(fields: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return new Request("http://localhost/families/family-1/shopping/paste", {
    body: formData,
    method: "POST",
  });
}
