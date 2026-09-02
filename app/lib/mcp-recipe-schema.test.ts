import { describe, expect, it } from "vitest";

import { upsertRecipeInputSchema } from "./mcp-recipe-schema";

const validIngredient = {
  categoryKey: "meat-fish",
  displayName: "Kyllingfilet",
};

describe("upsertRecipeInputSchema", () => {
  it("accepts a create payload with title and ingredients", () => {
    const result = upsertRecipeInputSchema.safeParse({
      ingredients: [validIngredient],
      title: "Kyllingwok",
    });

    expect(result.success).toBe(true);
  });

  it("rejects create without title or ingredients", () => {
    const result = upsertRecipeInputSchema.safeParse({});

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    const paths = result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toContain("title");
    expect(paths).toContain("ingredients");
  });

  it("rejects an ingredient without category identity", () => {
    const result = upsertRecipeInputSchema.safeParse({
      ingredients: [{ displayName: "Kyllingfilet" }],
      title: "Kyllingwok",
    });

    expect(result.success).toBe(false);
  });

  it("rejects extra fields", () => {
    const result = upsertRecipeInputSchema.safeParse({
      ingredients: [validIngredient],
      scope: "GLOBAL",
      title: "Kyllingwok",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a tags-only update", () => {
    const result = upsertRecipeInputSchema.safeParse({
      recipeId: "recipe-1",
      tags: ["middag", "rask"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects update with recipeId but no writable fields", () => {
    const result = upsertRecipeInputSchema.safeParse({
      recipeId: "recipe-1",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.issues[0]?.message).toBe(
      "Provide at least one field to update.",
    );
  });
});
