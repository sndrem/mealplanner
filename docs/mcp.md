# Family MCP server

The app exposes a [Model Context Protocol](https://modelcontextprotocol.io) server on the same process as the website (`GET`/`POST` `/mcp`). Production transport is **Streamable HTTP**, not stdio.

Most tools are read-only. Two tools write family data:

- `create_meal_plan_proposal` stores a **proposal** for a week; it never approves a live meal plan.
- `upsert_recipe` creates or updates a **family** recipe. It cannot create or change global recipes, and it cannot upload a cover image (use the website for photos).

## Mint a token

1. Sign in as a family **admin**.
2. Open the family page → **Familie**.
3. Under **AI-tilgang (MCP)**, create a key.
4. Copy the key immediately. It is shown once. Rotate it if it leaks.

The MCP address is `{origin}/mcp` (local: `http://localhost:5174/mcp` when running `npm run dev`; production: `https://<your-fly-app>.fly.dev/mcp`).

## Client config

Use Streamable HTTP with a Bearer header. Example Cursor MCP config:

```json
{
  "mcpServers": {
    "mealplanner": {
      "url": "https://mealplanner-xzvzow.fly.dev/mcp",
      "headers": {
        "Authorization": "Bearer <paste-the-family-key>"
      }
    }
  }
}
```

For local development, point `url` at `http://localhost:5174/mcp` and use a key minted on that environment.

You can also use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) against the same URL and header.

## Tools

Authenticated clients can call:

- `list_recipes` — family and global recipes (title, description, image URL, tags, servings, prep)
- `get_recipe` — one recipe including ingredients (category id/key/name, preferred store), tags, and reminder suggestions
- `list_ingredient_categories` — global ingredient categories (`id`, `key`, `displayName`) for `upsert_recipe`
- `get_current_week_meal_plan` — Europe/Oslo calendar week dinners (live DRAFT/APPROVED plans only)
- `list_meal_plans` — plan summaries (excludes open proposals)
- `get_shopping_list` — current family shopping projection
- `get_recent_dinners` — recently used dinner recipes
- `list_freezer_items` — freezer stock
- `create_meal_plan_proposal` — create or replace a proposed dinner plan for a calendar week
- `upsert_recipe` — create a family recipe, or update one by `recipeId`

`create_meal_plan_proposal` defaults to **next** Europe/Oslo week (Monday–Sunday) when `weekStart` / `weekEnd` are omitted. Re-running for the same week updates the existing proposal in place and returns the same URL. It fails if a live DRAFT or APPROVED plan already covers that week.

The tool returns `proposalUrl`. Put that in email as **Se forslaget i Mealplanner her**. Opening the link (after login) shows the proposal UI, where a family member can adjust dinners and approve. Approval turns the proposal into a live meal plan. MCP cannot approve or reopen plans.

`upsert_recipe` without `recipeId` creates a family recipe (title and at least one ingredient required). With `recipeId`, it patches that family recipe: omitted fields stay unchanged. `tags`, `ingredients`, and `reminderSuggestions` **replace** the stored list when sent. Identify ingredient categories with `categoryKey` (preferred), `categoryId`, or category display name. If `defaultServings` or `prepMinutes` are omitted on create, the web-form defaults apply (2 servings, 45 minutes). Cover images stay in the web UI.

The token is scoped to one family.

## Deploy

No extra Fly process, port, or secret. The `/mcp` route deploys with the existing web app. See [deploy-fly.md](./deploy-fly.md).
