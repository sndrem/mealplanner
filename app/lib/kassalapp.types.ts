export const KASSALAPP_API_BASE_URL = "https://kassal.app/api/v1";

export type KassalappStoreCode =
  | "BUNNPRIS"
  | "KIWI"
  | "MENY_NO"
  | "REMA_1000"
  | "SPAR_NO";

export interface KassalappStoreRef {
  code: string;
  logo: string;
  name: string;
  url: string;
}

export interface KassalappProduct {
  brand: string | null;
  current_price: number | null;
  current_unit_price: number | null;
  ean: string | null;
  id: number;
  name: string;
  store: KassalappStoreRef[];
  vendor: string | null;
}

export interface KassalappProductSearchResponse {
  data: KassalappProduct[];
}

export interface KassalappBulkPriceStore {
  current_price: number | null;
  current_unit_price: number | null;
  current_unit_price_unit: string | null;
  last_checked: string | null;
  name: string;
  store: string;
}

export interface KassalappBulkPriceHistoryItem {
  ean: string;
  name: string;
  price_history: Array<{
    date: string;
    price: number;
    store: string;
  }>;
  stores: KassalappBulkPriceStore[];
  weight: number | null;
  weight_unit: string | null;
}

export interface KassalappBulkPriceResponse {
  data: KassalappBulkPriceHistoryItem[];
  meta: {
    days_included: number;
    found_products: number;
    is_premium: boolean;
    requested_eans: number;
  };
}

export interface KassalappHealthResponse {
  status: string;
}

export class KassalappApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "KassalappApiError";
  }
}

export type ShoppingListCostEstimate =
  | {
      reason: string;
      status: "unavailable";
    }
  | {
      itemMatches: Array<{
        ean: string | null;
        pricesByStore: Partial<Record<KassalappStoreCode, number>>;
        searchTerm: string;
        sourceKey: string;
      }>;
      meta: {
        bulkCalls: number;
        cachedHits: number;
        searchCalls: number;
      };
      status: "ok";
      stores: Array<{
        code: KassalappStoreCode;
        matchedCount: number;
        name: string;
        total: number;
        unmatchedCount: number;
      }>;
      unmatchedItems: Array<{
        name: string;
        sourceKey: string;
      }>;
    };
