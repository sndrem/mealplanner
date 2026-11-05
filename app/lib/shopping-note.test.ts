import { describe, expect, it } from "vitest";

import {
  buildShoppingNotePrompt,
  parseShoppingNoteModelJson,
  parseShoppingNoteReviewItems,
  pickShoppingNoteCategoryId,
  shoppingNoteMessages,
  shoppingNoteQuantityForStorage,
  validateShoppingNoteLength,
  SHOPPING_NOTE_MAX_ITEMS,
  SHOPPING_NOTE_MAX_LENGTH,
} from "./shopping-note";

const allowedCategoryIds = new Set(["cat-dairy", "cat-other"]);

describe("shopping note parsing", () => {
  it("keeps several items and a stated quantity", () => {
    const result = parseShoppingNoteModelJson(
      {
        items: [
          { categoryId: "cat-dairy", name: " Melk ", quantity: "2 liter" },
          { categoryId: "cat-other", name: "Brød", quantity: null },
        ],
      },
      allowedCategoryIds,
    );

    expect(result).toEqual({
      items: [
        { categoryId: "cat-dairy", name: "Melk", quantity: "2 liter" },
        { categoryId: "cat-other", name: "Brød", quantity: null },
      ],
      ok: true,
    });
  });

  it("drops empty names and unknown categories without failing the note", () => {
    const result = parseShoppingNoteModelJson(
      {
        items: [
          { categoryId: "missing", name: "Egg", quantity: "" },
          { categoryId: "cat-dairy", name: "   ", quantity: "1" },
          { name: "Brød" },
        ],
      },
      allowedCategoryIds,
    );

    expect(result).toEqual({
      items: [
        { categoryId: null, name: "Egg", quantity: null },
        { categoryId: null, name: "Brød", quantity: null },
      ],
      ok: true,
    });
  });

  it("rejects an empty or malformed model payload", () => {
    expect(parseShoppingNoteModelJson({ items: [] }, allowedCategoryIds)).toEqual({
      error: shoppingNoteMessages.noItems,
      ok: false,
    });
    expect(parseShoppingNoteModelJson({ note: "melk" }, allowedCategoryIds)).toEqual({
      error: shoppingNoteMessages.badJson,
      ok: false,
    });
    expect(parseShoppingNoteModelJson("melk og brød", allowedCategoryIds).ok).toBe(
      false,
    );
  });

  it("rejects more than the item cap", () => {
    const items = Array.from({ length: SHOPPING_NOTE_MAX_ITEMS + 1 }, (_, index) => ({
      categoryId: "cat-other",
      name: `Vare ${index}`,
      quantity: null,
    }));

    expect(parseShoppingNoteModelJson({ items }, allowedCategoryIds)).toEqual({
      error: shoppingNoteMessages.tooMany,
      ok: false,
    });
  });

  it("uses the model category when it is allowed, otherwise the resolver category", () => {
    expect(
      pickShoppingNoteCategoryId({
        allowedCategoryIds,
        modelCategoryId: "cat-dairy",
        resolverCategoryId: "cat-other",
      }),
    ).toBe("cat-dairy");
    expect(
      pickShoppingNoteCategoryId({
        allowedCategoryIds,
        modelCategoryId: "missing",
        resolverCategoryId: "cat-other",
      }),
    ).toBe("cat-other");
    expect(
      pickShoppingNoteCategoryId({
        allowedCategoryIds,
        modelCategoryId: null,
        resolverCategoryId: "missing",
      }),
    ).toBeNull();
  });

  it("stores a blank quantity as the quick-add default", () => {
    expect(shoppingNoteQuantityForStorage(null)).toBe("1");
    expect(shoppingNoteQuantityForStorage("  ")).toBe("1");
    expect(shoppingNoteQuantityForStorage("2 liter")).toBe("2 liter");
  });

  it("rejects an empty note and a note over the length cap", () => {
    expect(validateShoppingNoteLength("  \n")).toBe(shoppingNoteMessages.empty);
    expect(validateShoppingNoteLength("a".repeat(SHOPPING_NOTE_MAX_LENGTH + 1))).toBe(
      shoppingNoteMessages.tooLong,
    );
    expect(validateShoppingNoteLength("2 liter melk")).toBeNull();
  });

  it("rejects review rows with no items, a blank name, or an unknown category", () => {
    expect(parseShoppingNoteReviewItems([], allowedCategoryIds)).toEqual({
      error: shoppingNoteMessages.needOne,
      ok: false,
    });
    expect(
      parseShoppingNoteReviewItems(
        [
          {
            categoryId: "cat-dairy",
            name: " ",
            quantity: null,
            resolvedIngredientId: null,
            resolvedName: "Melk",
          },
        ],
        allowedCategoryIds,
      ),
    ).toEqual({
      error: shoppingNoteMessages.needName,
      ok: false,
    });
    expect(
      parseShoppingNoteReviewItems(
        [
          {
            categoryId: "",
            name: "Melk",
            quantity: "2 liter",
            resolvedIngredientId: null,
            resolvedName: "Melk",
          },
        ],
        allowedCategoryIds,
      ),
    ).toEqual({
      error: shoppingNoteMessages.needCategory,
      ok: false,
    });
  });

  it("lists each category id and display name in the prompt", () => {
    const prompt = buildShoppingNotePrompt({
      categories: [
        { displayName: "Meieri", id: "cat-dairy" },
        { displayName: "Annet", id: "cat-other" },
      ],
      note: "2 liter melk\nog brød",
    });

    expect(prompt).toContain("- cat-dairy: Meieri");
    expect(prompt).toContain("- cat-other: Annet");
    expect(prompt).toContain("2 liter melk\nog brød");
  });
});
