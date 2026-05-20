import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  test: {
    env: {
      DATABASE_URL: "postgresql://mealplanner:mealplanner@localhost:5466/mealplanner?schema=public",
      SESSION_SECRET: "test-session-secret-that-is-at-least-thirty-two-characters",
      NOTION_API_TOKEN: "test-notion-api-token",
      NOTION_INGREDIENTS_DATABASE_ID: "test-notion-ingredients-database-id",
      NOTION_RECIPES_DATABASE_ID: "test-notion-recipes-database-id",
    },
    environment: "node",
    globals: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./app/test/setup-client.ts"],
  },
});
