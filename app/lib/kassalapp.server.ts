import { scheduleKassalappRequest } from "./kassalapp-rate-limit.server";
import {
  KASSALAPP_API_BASE_URL,
  KassalappApiError,
  type KassalappBulkPriceResponse,
  type KassalappHealthResponse,
  type KassalappProductSearchResponse,
} from "./kassalapp.types";

interface KassalappRequestOptions {
  apiToken: string;
  body?: unknown;
  fetchImpl?: typeof fetch;
  method?: "GET" | "POST";
  path: string;
  rateLimitKey: string;
  searchParams?: Record<string, string | number | boolean | undefined>;
}

function buildKassalappUrl(
  path: string,
  searchParams?: KassalappRequestOptions["searchParams"],
) {
  const url = new URL(`${KASSALAPP_API_BASE_URL}${path}`);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined) {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function kassalappRequest<T>({
  apiToken,
  body,
  fetchImpl = fetch,
  method = "GET",
  path,
  rateLimitKey,
  searchParams,
}: KassalappRequestOptions): Promise<T> {
  if (!apiToken.trim()) {
    throw new KassalappApiError("Kassalapp API token is not configured.", 503);
  }

  const response = await scheduleKassalappRequest({
    rateLimitKey,
    request: () =>
      fetchImpl(buildKassalappUrl(path, searchParams), {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiToken}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        method,
      }),
  });

  if (response.ok) {
    return (await response.json()) as T;
  }

  let details: unknown;

  try {
    details = await response.json();
  } catch {
    details = undefined;
  }

  const message =
    typeof details === "object" &&
    details !== null &&
    "message" in details &&
    typeof details.message === "string"
      ? details.message
      : `Kassalapp API request failed with status ${response.status}.`;

  throw new KassalappApiError(message, response.status, details);
}

export async function checkKassalappHealth({
  apiToken,
  fetchImpl,
  rateLimitKey,
}: {
  apiToken: string;
  fetchImpl?: typeof fetch;
  rateLimitKey: string;
}) {
  const response = await kassalappRequest<KassalappHealthResponse>({
    apiToken,
    fetchImpl,
    path: "/health",
    rateLimitKey,
  });

  return response.status === "Healthy";
}

export async function searchKassalappProducts({
  apiToken,
  fetchImpl,
  rateLimitKey,
  search,
  size = 10,
  unique = true,
}: {
  apiToken: string;
  fetchImpl?: typeof fetch;
  rateLimitKey: string;
  search: string;
  size?: number;
  unique?: boolean;
}) {
  return kassalappRequest<KassalappProductSearchResponse>({
    apiToken,
    fetchImpl,
    path: "/products",
    rateLimitKey,
    searchParams: {
      search,
      size,
      unique,
    },
  });
}

export async function getKassalappBulkPrices({
  aggregation = "min",
  apiToken,
  days = 1,
  eans,
  fetchImpl,
  rateLimitKey,
}: {
  aggregation?: "avg" | "max" | "min";
  apiToken: string;
  days?: number;
  eans: string[];
  fetchImpl?: typeof fetch;
  rateLimitKey: string;
}) {
  return kassalappRequest<KassalappBulkPriceResponse>({
    apiToken,
    body: {
      aggregation,
      days,
      eans,
    },
    fetchImpl,
    method: "POST",
    path: "/products/prices-bulk",
    rateLimitKey,
  });
}
