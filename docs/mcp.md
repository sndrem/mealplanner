# Family MCP server

The app exposes a **read-only** [Model Context Protocol](https://modelcontextprotocol.io) server on the same process as the website (`GET`/`POST` `/mcp`). Production transport is **Streamable HTTP**, not stdio.

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
- `get_recipe` — one recipe including ingredients
- `get_current_week_meal_plan` — Europe/Oslo calendar week dinners
- `list_meal_plans` — plan summaries
- `get_shopping_list` — current family shopping projection
- `get_recent_dinners` — recently used dinner recipes
- `list_freezer_items` — freezer stock

The token is scoped to one family. Tools never create or approve meal plans.

## Deploy

No extra Fly process, port, or secret. The `/mcp` route deploys with the existing web app. See [deploy-fly.md](./deploy-fly.md).
