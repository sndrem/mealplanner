import { beforeEach, describe, expect, it, vi } from "vitest";

const { envMock } = vi.hoisted(() => ({
  envMock: {
    R2_ACCOUNT_ID: "account",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET_NAME: "mealplanner-recipe-images",
    R2_PUBLIC_BASE_URL: "https://images.example.com",
  },
}));

vi.mock("./env.server", () => ({
  env: envMock,
}));

import {
  buildRecipeCoverKey,
  getRecipeImageUrl,
  isR2Configured,
} from "./r2.server";

describe("r2.server", () => {
  beforeEach(() => {
    envMock.R2_ACCOUNT_ID = "account";
    envMock.R2_ACCESS_KEY_ID = "key";
    envMock.R2_SECRET_ACCESS_KEY = "secret";
    envMock.R2_BUCKET_NAME = "mealplanner-recipe-images";
    envMock.R2_PUBLIC_BASE_URL = "https://images.example.com";
  });

  it("reports configured when all R2 env vars are set", () => {
    expect(isR2Configured()).toBe(true);
  });

  it("reports not configured when a required var is missing", () => {
    envMock.R2_PUBLIC_BASE_URL = undefined as unknown as string;
    expect(isR2Configured()).toBe(false);
  });

  it("builds public image URLs from keys", () => {
    expect(getRecipeImageUrl("families/f1/recipes/r1/cover.jpg")).toBe(
      "https://images.example.com/families/f1/recipes/r1/cover.jpg",
    );
    expect(getRecipeImageUrl(null)).toBeNull();
  });

  it("builds stable cover object keys", () => {
    expect(
      buildRecipeCoverKey({
        contentType: "image/jpeg",
        familyId: "family-1",
        recipeId: "recipe-1",
      }),
    ).toBe("families/family-1/recipes/recipe-1/cover.jpg");
  });
});
