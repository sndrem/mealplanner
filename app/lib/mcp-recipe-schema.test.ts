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

  it("accepts a create payload with an https cover URL", () => {
    const result = upsertRecipeInputSchema.safeParse({
      imageUrl: "https://images.example.com/cover.jpg",
      ingredients: [validIngredient],
      title: "Kyllingwok",
    });

    expect(result.success).toBe(true);
  });

  it("accepts an image-only update", () => {
    const result = upsertRecipeInputSchema.safeParse({
      imageUrl: "https://images.example.com/cover.jpg",
      recipeId: "recipe-1",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a remove-cover update", () => {
    const result = upsertRecipeInputSchema.safeParse({
      recipeId: "recipe-1",
      removeCoverImage: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an http cover URL", () => {
    const result = upsertRecipeInputSchema.safeParse({
      imageUrl: "http://images.example.com/cover.jpg",
      ingredients: [validIngredient],
      title: "Kyllingwok",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.issues.map((issue) => issue.path.join("."))).toContain(
      "imageUrl",
    );
  });

  it("rejects a cover URL with userinfo", () => {
    const result = upsertRecipeInputSchema.safeParse({
      imageUrl: "https://user:pass@images.example.com/cover.jpg",
      ingredients: [validIngredient],
      title: "Kyllingwok",
    });

    expect(result.success).toBe(false);
  });

  it("rejects removeCoverImage when creating a recipe", () => {
    const result = upsertRecipeInputSchema.safeParse({
      ingredients: [validIngredient],
      removeCoverImage: true,
      title: "Kyllingwok",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.issues.map((issue) => issue.message)).toContain(
      "removeCoverImage is only valid when updating a recipe.",
    );
  });

  it("rejects imageUrl together with removeCoverImage", () => {
    const result = upsertRecipeInputSchema.safeParse({
      imageUrl: "https://images.example.com/cover.jpg",
      recipeId: "recipe-1",
      removeCoverImage: true,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.issues.map((issue) => issue.message)).toContain(
      "Provide imageUrl or removeCoverImage, not both.",
    );
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
