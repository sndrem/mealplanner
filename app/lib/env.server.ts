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

function optionalTrimmedString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const optionalPortSchema = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return undefined;
  }

  return value;
}, z.coerce.number().int().min(1).max(65535).optional());

const envSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  SESSION_SECRET: sessionSecretSchema,
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: optionalPortSchema,
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
});

const parsedEnv = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  SMTP_HOST: optionalTrimmedString(process.env.SMTP_HOST),
  SMTP_PORT: optionalTrimmedString(process.env.SMTP_PORT),
  SMTP_USER: optionalTrimmedString(process.env.SMTP_USER),
  SMTP_PASS: optionalTrimmedString(process.env.SMTP_PASS),
  EMAIL_FROM: optionalTrimmedString(process.env.EMAIL_FROM),
  R2_ACCOUNT_ID: optionalTrimmedString(process.env.R2_ACCOUNT_ID),
  R2_ACCESS_KEY_ID: optionalTrimmedString(process.env.R2_ACCESS_KEY_ID),
  R2_SECRET_ACCESS_KEY: optionalTrimmedString(process.env.R2_SECRET_ACCESS_KEY),
  R2_BUCKET_NAME: optionalTrimmedString(process.env.R2_BUCKET_NAME),
  R2_PUBLIC_BASE_URL: optionalTrimmedString(process.env.R2_PUBLIC_BASE_URL),
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
