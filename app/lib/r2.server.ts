import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "./env.server";

export const RECIPE_COVER_MAX_BYTES = 2 * 1024 * 1024;
export const RECIPE_COVER_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type RecipeCoverContentType =
  (typeof RECIPE_COVER_CONTENT_TYPES)[number];

let cachedClient: S3Client | null = null;

export function isR2Configured() {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME &&
      env.R2_PUBLIC_BASE_URL,
  );
}

export function getRecipeImageUrl(imageKey: string | null | undefined) {
  if (!imageKey || !env.R2_PUBLIC_BASE_URL) {
    return null;
  }

  const base = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const key = imageKey.replace(/^\/+/, "");
  return `${base}/${key}`;
}

function getS3Client() {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 er ikke konfigurert.");
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: "auto",
    });
  }

  return cachedClient;
}

function extensionForContentType(contentType: RecipeCoverContentType) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

export function buildRecipeCoverKey({
  contentType,
  familyId,
  recipeId,
}: {
  contentType: RecipeCoverContentType;
  familyId: string;
  recipeId: string;
}) {
  return `families/${familyId}/recipes/${recipeId}/cover.${extensionForContentType(contentType)}`;
}

export async function uploadRecipeCover({
  bytes,
  contentType,
  familyId,
  recipeId,
}: {
  bytes: Uint8Array;
  contentType: RecipeCoverContentType;
  familyId: string;
  recipeId: string;
}) {
  const key = buildRecipeCoverKey({ contentType, familyId, recipeId });
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Body: bytes,
      Bucket: env.R2_BUCKET_NAME,
      ContentType: contentType,
      Key: key,
    }),
  );

  return key;
}

export async function deleteR2Object(key: string | null | undefined) {
  if (!key || !isR2Configured()) {
    return;
  }

  try {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
      }),
    );
  } catch (error) {
    console.error("Failed to delete R2 object", { error, key });
  }
}
