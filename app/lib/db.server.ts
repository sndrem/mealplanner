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

export const db = createDbClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__db = db;
}

function createDbClient() {
  const generatedModelSignature = buildGeneratedModelSignature();
  const cachedClient = globalForPrisma.__db;
  const shouldReuseCachedClient =
    Boolean(cachedClient) &&
    buildCachedModelSignature(cachedClient) === generatedModelSignature &&
    clientHasAllGeneratedDelegates(cachedClient);

  if (cachedClient && !shouldReuseCachedClient) {
    void cachedClient.$disconnect().catch(() => undefined);
  }

  if (shouldReuseCachedClient && cachedClient) {
    return cachedClient;
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });
}

function buildGeneratedModelSignature() {
  return Prisma.dmmf.datamodel.models
    .map((model) => `${model.name}:${model.fields.map((field) => field.name).join(",")}`)
    .sort()
    .join("|");
}

function buildCachedModelSignature(client: PrismaClient | undefined) {
  const runtimeModels = (client as PrismaClientWithRuntimeModel | undefined)
    ?._runtimeDataModel?.models;

  if (!runtimeModels) {
    return null;
  }

  return Object.entries(runtimeModels)
    .map(
      ([modelName, model]) =>
        `${modelName}:${(model.fields ?? []).map((field) => field.name).join(",")}`,
    )
    .sort()
    .join("|");
}

function clientHasAllGeneratedDelegates(client: PrismaClient | undefined) {
  if (!client) {
    return false;
  }

  return Prisma.dmmf.datamodel.models.every((model) => {
    const delegateKey = modelNameToDelegateKey(model.name);
    const delegate = (client as unknown as Record<string, { findMany?: unknown }>)[
      delegateKey
    ];
    return typeof delegate?.findMany === "function";
  });
}

function modelNameToDelegateKey(modelName: string) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}
