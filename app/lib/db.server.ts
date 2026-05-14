import { Prisma, PrismaClient } from "@prisma/client";

import { env } from "./env.server";

const globalForPrisma = globalThis as typeof globalThis & {
  __db?: PrismaClient;
};

type PrismaClientWithRuntimeModel = PrismaClient & {
  _runtimeDataModel?: {
    models?: Record<string, { fields?: Array<{ name: string }> }>;
  };
};

const generatedModelSignature = buildGeneratedModelSignature();
const cachedModelSignature = buildCachedModelSignature(globalForPrisma.__db);
const shouldReuseCachedClient =
  globalForPrisma.__db && cachedModelSignature === generatedModelSignature;

if (globalForPrisma.__db && !shouldReuseCachedClient) {
  void globalForPrisma.__db.$disconnect().catch(() => undefined);
}

export const db = shouldReuseCachedClient
  ? globalForPrisma.__db!
  : new PrismaClient({
      datasources: {
        db: {
          url: env.DATABASE_URL,
        },
      },
    });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__db = db;
}

function buildGeneratedModelSignature() {
  return Prisma.dmmf.datamodel.models
    .map((model) => `${model.name}:${model.fields.map((field) => field.name).join(",")}`)
    .sort()
    .join("|");
}

function buildCachedModelSignature(client: PrismaClient | undefined) {
  const runtimeModels = (client as PrismaClientWithRuntimeModel | undefined)?._runtimeDataModel?.models;

  if (!runtimeModels) {
    return null;
  }

  return Object.entries(runtimeModels)
    .map(([modelName, model]) => `${modelName}:${(model.fields ?? []).map((field) => field.name).join(",")}`)
    .sort()
    .join("|");
}
