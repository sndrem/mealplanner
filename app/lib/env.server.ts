import { config as loadEnvFromFile } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

// Populate `process.env` from the repo-root `.env` before validation.
// `.env.example` is never read here — it exists only as a template in git.
// Run `dev` / `start` from the project root so this path resolves.
loadEnvFromFile({ path: resolve(process.cwd(), ".env") });

const databaseUrlSchema = z
  .string()
  .trim()
  .min(1, "DATABASE_URL is required")
  .superRefine((value, ctx) => {
    try {
      const url = new URL(value);

      if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "DATABASE_URL must use the postgres:// or postgresql:// protocol",
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL must be a valid URL",
      });
    }
  });

const sessionSecretSchema = z
  .string()
  .trim()
  .min(32, "SESSION_SECRET must be at least 32 characters long");
const notionTokenSchema = z
  .string()
  .trim()
  .min(1, "NOTION_API_TOKEN is required");
const notionDatabaseIdSchema = z
  .string()
  .trim()
  .min(1, "NOTION_RECIPES_DATABASE_ID is required");
const notionIngredientsDatabaseIdSchema = z
  .string()
  .trim()
  .min(1, "NOTION_INGREDIENTS_DATABASE_ID is required");

const envSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  NOTION_API_TOKEN: notionTokenSchema,
  NOTION_INGREDIENTS_DATABASE_ID: notionIngredientsDatabaseIdSchema,
  NOTION_RECIPES_DATABASE_ID: notionDatabaseIdSchema,
  SESSION_SECRET: sessionSecretSchema,
});

const parsedEnv = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  NOTION_API_TOKEN: process.env.NOTION_API_TOKEN,
  NOTION_INGREDIENTS_DATABASE_ID: process.env.NOTION_INGREDIENTS_DATABASE_ID,
  NOTION_RECIPES_DATABASE_ID: process.env.NOTION_RECIPES_DATABASE_ID,
  SESSION_SECRET: process.env.SESSION_SECRET,
});

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map(
      (issue) => `${issue.path.join(".") || "DATABASE_URL"}: ${issue.message}`,
    )
    .join("\n");

  throw new Error(`Invalid server environment configuration:\n${issues}`);
}

export const env = parsedEnv.data;
