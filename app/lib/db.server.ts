import { PrismaClient } from "@prisma/client";

import { env } from "./env.server";

const globalForPrisma = globalThis as typeof globalThis & {
  __db?: PrismaClient;
};

export const db =
  globalForPrisma.__db ??
  new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__db = db;
}
