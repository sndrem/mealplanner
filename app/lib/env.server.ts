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

const envSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
});

const parsedEnv = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
});

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "DATABASE_URL"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid server environment configuration:\n${issues}`);
}

export const env = parsedEnv.data;
