import { z } from "zod";

const databaseUrlSchema = z.string().trim().min(1, "DATABASE_URL is required").superRefine((value, ctx) => {
  try {
    const url = new URL(value);

    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL must use the postgres:// or postgresql:// protocol",
      });
    }
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "DATABASE_URL must be a valid URL",
    });
  }
});

const sessionSecretSchema = z.string().trim().min(32, "SESSION_SECRET must be at least 32 characters long");

const envSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  SESSION_SECRET: sessionSecretSchema,
});

const parsedEnv = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
});

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "DATABASE_URL"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid server environment configuration:\n${issues}`);
}

export const env = parsedEnv.data;
