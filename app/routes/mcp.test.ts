import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/mcp-token.server", () => ({
  resolveFamilyMcpAuth: vi.fn(),
}));

vi.mock("../lib/mcp-handler.server", () => ({
  mcpHttpHandler: {
    fetch: vi.fn(),
  },
}));

import { mcpHttpHandler } from "../lib/mcp-handler.server";
import { resolveFamilyMcpAuth } from "../lib/mcp-token.server";
import { action, loader } from "./mcp";

describe("mcp route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a valid family token", async () => {
    vi.mocked(resolveFamilyMcpAuth).mockResolvedValue(null);

    const request = new Request("http://localhost/mcp", {
      headers: { Authorization: "Bearer bad" },
      method: "POST",
    });

    const result = await action({ request });

    expect(result.status).toBe(401);
    expect(result.headers.get("WWW-Authenticate")).toBe(
      'Bearer realm="mealplanner-mcp"',
    );
    expect(mcpHttpHandler.fetch).not.toHaveBeenCalled();
  });

  it("passes family auth into the MCP handler", async () => {
    vi.mocked(resolveFamilyMcpAuth).mockResolvedValue({
      familyId: "family-1",
      userId: "user-1",
    });
    vi.mocked(mcpHttpHandler.fetch).mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    const request = new Request("http://localhost/mcp", {
      headers: { Authorization: "Bearer good-token" },
      method: "POST",
    });

    const result = await loader({ request });

    expect(resolveFamilyMcpAuth).toHaveBeenCalledWith("Bearer good-token");
    expect(mcpHttpHandler.fetch).toHaveBeenCalledWith(request, {
      authInfo: {
        clientId: "family-1",
        extra: {
          familyId: "family-1",
          userId: "user-1",
        },
        scopes: ["mcp:read"],
        token: "good-token",
      },
    });
    expect(result.status).toBe(200);
  });
});
