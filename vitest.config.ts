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
    },
    environment: "node",
    globals: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./app/test/setup-client.ts"],
  },
});
