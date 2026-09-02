import {
  type AuthInfo,
  createMcpHandler,
  McpServer,
} from "@modelcontextprotocol/server";
import { z } from "zod";

import { upsertRecipeInputSchema } from "./mcp-recipe-schema";
import {
  createMealPlanProposalForMcp,
  getCurrentWeekMealPlanForMcp,
  getRecentDinnersForMcp,
  getRecipeForMcp,
  getShoppingListForMcp,
  listFreezerItemsForMcp,
  listIngredientCategoriesForMcp,
  listMealPlansForMcp,
  listRecipesForMcp,
  upsertRecipeForMcp,
} from "./mcp-tools.server";

function requireMcpActor(authInfo: AuthInfo | undefined) {
  const familyId =
    typeof authInfo?.extra?.familyId === "string" ? authInfo.extra.familyId : "";
  const userId =
    typeof authInfo?.extra?.userId === "string" ? authInfo.extra.userId : "";

  if (!familyId || !userId) {
    throw new Error("MCP request is missing family auth.");
  }

  return { familyId, userId };
}

function requireMcpOrigin(authInfo: AuthInfo | undefined) {
  const origin =
    typeof authInfo?.extra?.origin === "string" ? authInfo.extra.origin : "";

  if (!origin) {
    throw new Error("MCP request is missing origin.");
  }

  return origin;
}

function jsonResult(data: unknown, summary: string) {
  return {
    content: [{ text: summary, type: "text" as const }],
    structuredContent: data as Record<string, unknown>,
  };
}

export const mcpHttpHandler = createMcpHandler(
  ({ authInfo }) => {
    const actor = requireMcpActor(authInfo);
    const server = new McpServer({
      name: "mealplanner",
      version: "1.0.0",
    });

    server.registerTool(
      "list_recipes",
      {
        description:
          "List family and global recipes with title, description, image URL, tags, servings, and prep time.",
        inputSchema: z.object({}),
      },
      async () => {
        const data = await listRecipesForMcp(actor);
        return jsonResult(
          data,
          `Found ${data.recipes.length} recipes.`,
        );
      },
    );

    server.registerTool(
      "get_recipe",
      {
        description:
          "Get one accessible recipe (family or global) including ingredients, category keys, preferred stores, and reminder suggestions.",
        inputSchema: z.object({
          recipeId: z.string().min(1).describe("Recipe id"),
        }),
      },
      async ({ recipeId }) => {
        const data = await getRecipeForMcp({ ...actor, recipeId });

        if (!data) {
          return {
            content: [{ text: "Fant ikke oppskriften.", type: "text" as const }],
            isError: true,
          };
        }

        return jsonResult(data, data.recipe.title);
      },
    );

    server.registerTool(
      "get_current_week_meal_plan",
      {
        description:
          "Get this week's dinner plan (Europe/Oslo calendar week), including recipe title, description, and image URL.",
        inputSchema: z.object({}),
      },
      async () => {
        const data = await getCurrentWeekMealPlanForMcp(actor);
        return jsonResult(
          data,
          data.mealPlan
            ? `Meal plan ${data.mealPlan.title} covers ${data.weekStart}–${data.weekEnd}.`
            : `No meal plan covers ${data.weekStart}–${data.weekEnd}.`,
        );
      },
    );

    server.registerTool(
      "list_meal_plans",
      {
        description: "List meal plan summaries for the family.",
        inputSchema: z.object({}),
      },
      async () => {
        const data = await listMealPlansForMcp(actor);
        return jsonResult(data, `${data.mealPlans.length} meal plans.`);
      },
    );

    server.registerTool(
      "get_shopping_list",
      {
        description:
          "Get the current family shopping list (generated, manual, and family items).",
        inputSchema: z.object({}),
      },
      async () => {
        const data = await getShoppingListForMcp(actor);
        return jsonResult(
          data,
          `${data.itemCounts.unchecked} unchecked of ${data.itemCounts.total} items (${data.activeListMode}).`,
        );
      },
    );

    server.registerTool(
      "get_recent_dinners",
      {
        description:
          "List recently used dinner recipes so a planner can avoid repeats.",
        inputSchema: z.object({}),
      },
      async () => {
        const data = await getRecentDinnersForMcp(actor);
        return jsonResult(
          data,
          `${data.recipes.length} recently used dinner recipes.`,
        );
      },
    );

    server.registerTool(
      "list_freezer_items",
      {
        description: "List the family's freezer items.",
        inputSchema: z.object({}),
      },
      async () => {
        const data = await listFreezerItemsForMcp(actor);
        return jsonResult(
          data,
          `${data.freezerItems.length} freezer items.`,
        );
      },
    );

    server.registerTool(
      "list_ingredient_categories",
      {
        description:
          "List global ingredient categories (id, key, display name) for recipe ingredients.",
        inputSchema: z.object({}),
      },
      async () => {
        const data = await listIngredientCategoriesForMcp();
        return jsonResult(
          data,
          `${data.categories.length} ingredient categories.`,
        );
      },
    );

    server.registerTool(
      "create_meal_plan_proposal",
      {
        description:
          "Create or replace a proposed dinner plan for a Europe/Oslo calendar week (defaults to next week). Does not approve the plan.",
        inputSchema: z.object({
          dinners: z
            .array(
              z.object({
                date: z.string().min(1).describe("YYYY-MM-DD"),
                freezerItemId: z.string().optional(),
                note: z.string().optional(),
                recipeId: z.string().optional(),
              }),
            )
            .describe("Dinners to store. Days omitted stay empty."),
          title: z.string().optional().describe("Optional meal plan title"),
          weekEnd: z
            .string()
            .optional()
            .describe("Sunday YYYY-MM-DD of the calendar week"),
          weekStart: z
            .string()
            .optional()
            .describe("Monday YYYY-MM-DD of the calendar week"),
        }),
      },
      async ({ dinners, title, weekEnd, weekStart }) => {
        const origin = requireMcpOrigin(authInfo);
        const data = await createMealPlanProposalForMcp({
          ...actor,
          dinners,
          origin,
          title,
          weekEnd,
          weekStart,
        });

        if (data.status !== "CREATED") {
          return {
            content: [{ text: data.formError, type: "text" as const }],
            isError: true,
          };
        }

        return jsonResult(
          data,
          `Proposal ${data.proposalId} ready for ${data.weekStart}–${data.weekEnd}.`,
        );
      },
    );

    server.registerTool(
      "upsert_recipe",
      {
        description:
          "Create a family recipe, or update one by recipeId. Omitted fields stay unchanged on update. tags, ingredients, and reminderSuggestions replace the stored list when sent. FAMILY recipes only; cover images stay in the web UI. Omit servings/prep on create to use the same defaults as the web form (2 servings, 45 minutes).",
        inputSchema: upsertRecipeInputSchema,
      },
      async (input) => {
        const origin = requireMcpOrigin(authInfo);
        const data = await upsertRecipeForMcp({
          ...actor,
          ...input,
          origin,
        });

        if (data.status === "VALIDATION_ERROR" || data.status === "NOT_FOUND") {
          return {
            content: [{ text: data.formError, type: "text" as const }],
            isError: true,
          };
        }

        return jsonResult(
          data,
          data.status === "CREATED"
            ? `Created recipe ${data.recipe.title}.`
            : `Updated recipe ${data.recipe.title}.`,
        );
      },
    );

    return server;
  },
  {
    responseMode: "json",
  },
);
