import { z } from "zod";

import { RECIPE_REMINDER_TIMING_KINDS } from "./recipe-reminder";

const UPSERT_RECIPE_WRITABLE_KEYS = [
  "defaultServings",
  "description",
  "imageUrl",
  "ingredients",
  "prepMinutes",
  "reminderSuggestions",
  "removeCoverImage",
  "tags",
  "title",
] as const;

const mcpRecipeIngredientInputSchema = z
  .object({
    amount: z.string().optional().describe("Quantity amount, e.g. 500"),
    category: z
      .string()
      .min(1)
      .optional()
      .describe("Ingredient category display name"),
    categoryId: z.string().min(1).optional().describe("Ingredient category id"),
    categoryKey: z
      .string()
      .min(1)
      .optional()
      .describe("Ingredient category key, e.g. meat-fish"),
    displayName: z.string().min(1).describe("Ingredient name"),
    preferredStoreId: z.string().min(1).optional(),
    unit: z.string().optional().describe("Unit, e.g. g"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.categoryKey && !value.categoryId && !value.category) {
      ctx.addIssue({
        code: "custom",
        message: "Provide categoryKey, categoryId, or category display name.",
        path: ["categoryKey"],
      });
    }
  });

const mcpRecipeReminderInputSchema = z
  .object({
    note: z.string().optional(),
    timingKind: z.enum(RECIPE_REMINDER_TIMING_KINDS).optional(),
    title: z.string().min(1),
  })
  .strict();

export const upsertRecipeInputSchema = z
  .object({
    defaultServings: z.number().int().positive().optional(),
    description: z.string().optional(),
    imageUrl: z
      .string()
      .min(1)
      .optional()
      .describe(
        "HTTPS URL of a JPEG, PNG, or WebP cover image, max 2 MB. The server copies it into storage.",
      ),
    ingredients: z.array(mcpRecipeIngredientInputSchema).optional(),
    prepMinutes: z.number().int().positive().optional(),
    recipeId: z
      .string()
      .min(1)
      .optional()
      .describe("When set, update this family recipe"),
    reminderSuggestions: z.array(mcpRecipeReminderInputSchema).optional(),
    removeCoverImage: z
      .literal(true)
      .optional()
      .describe("When true on update, clear the stored cover image"),
    tags: z.array(z.string()).optional(),
    title: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasWritableField = UPSERT_RECIPE_WRITABLE_KEYS.some(
      (key) => value[key] !== undefined,
    );

    if (value.imageUrl !== undefined && !isHttpsUrlWithoutUserinfo(value.imageUrl)) {
      ctx.addIssue({
        code: "custom",
        message: "imageUrl must be an https URL without userinfo.",
        path: ["imageUrl"],
      });
    }

    if (value.removeCoverImage && !value.recipeId) {
      ctx.addIssue({
        code: "custom",
        message: "removeCoverImage is only valid when updating a recipe.",
        path: ["removeCoverImage"],
      });
    }

    if (value.imageUrl !== undefined && value.removeCoverImage) {
      ctx.addIssue({
        code: "custom",
        message: "Provide imageUrl or removeCoverImage, not both.",
      });
    }

    if (value.recipeId) {
      if (!hasWritableField) {
        ctx.addIssue({
          code: "custom",
          message: "Provide at least one field to update.",
        });
      }
      return;
    }

    if (!value.title?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Title is required when creating a recipe.",
        path: ["title"],
      });
    }

    if (!value.ingredients || value.ingredients.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one ingredient when creating a recipe.",
        path: ["ingredients"],
      });
    }
  });

export type UpsertRecipeInput = z.infer<typeof upsertRecipeInputSchema>;

function isHttpsUrlWithoutUserinfo(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
