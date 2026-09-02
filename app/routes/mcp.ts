import { mcpHttpHandler } from "../lib/mcp-handler.server";
import { resolveFamilyMcpAuth } from "../lib/mcp-token.server";

function unauthorizedResponse() {
  return new Response("Unauthorized", {
    headers: {
      "WWW-Authenticate": 'Bearer realm="mealplanner-mcp"',
    },
    status: 401,
    statusText: "Unauthorized",
  });
}

async function handleMcpRequest(request: Request) {
  const auth = await resolveFamilyMcpAuth(request.headers.get("Authorization"));

  if (!auth) {
    return unauthorizedResponse();
  }

  return mcpHttpHandler.fetch(request, {
    authInfo: {
      clientId: auth.familyId,
      extra: {
        familyId: auth.familyId,
        origin: new URL(request.url).origin,
        userId: auth.userId,
      },
      scopes: ["mcp:read", "mcp:write"],
      token: request.headers.get("Authorization")?.slice("Bearer ".length).trim() ?? "",
    },
  });
}

export async function loader({ request }: { request: Request }) {
  return handleMcpRequest(request);
}

export async function action({ request }: { request: Request }) {
  return handleMcpRequest(request);
}
