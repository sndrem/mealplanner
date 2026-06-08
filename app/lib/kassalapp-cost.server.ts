import {
  getFamilyKassalappApiToken,
  isKassalappConfiguredForFamily,
} from "./kassalapp-integration.server";
import {
  getCachedBulkPriceResult,
  getCachedSearchResult,
  setCachedBulkPriceResult,
  setCachedSearchResult,
} from "./kassalapp-cache.server";
import { pickBestProductMatch } from "./kassalapp-match.server";
import {
  dedupeShoppingSearchTerms,
  getUncheckedShoppingItems,
  normalizeShoppingSearchTerm,
} from "./kassalapp-search.server";
import { getKassalappBulkPrices, searchKassalappProducts } from "./kassalapp.server";
import {
  DEFAULT_KASSALAPP_STORE_CODES,
  isKassalappStoreCode,
  KASSALAPP_STORE_DISPLAY_NAMES,
} from "./kassalapp-stores.server";
import type {
  KassalappBulkPriceHistoryItem,
  KassalappProduct,
  KassalappStoreCode,
  ShoppingListCostEstimate,
} from "./kassalapp.types";
import type { ProjectedShoppingItem } from "./shopping.server";

const BULK_EAN_BATCH_SIZE = 100;

interface MatchedSearchTerm {
  ean: string | null;
  product: KassalappProduct | null;
  searchTerm: string;
}

interface TermPriceLookup {
  ean: string | null;
  pricesByStore: Partial<Record<KassalappStoreCode, number>>;
  product: KassalappProduct | null;
  searchTerm: string;
}

export async function estimateShoppingListCost({
  familyId,
  fetchImpl,
  items,
  storeCodes = DEFAULT_KASSALAPP_STORE_CODES,
}: {
  familyId: string;
  fetchImpl?: typeof fetch;
  items: ProjectedShoppingItem[];
  storeCodes?: readonly KassalappStoreCode[];
}): Promise<ShoppingListCostEstimate> {
  if (!(await isKassalappConfiguredForFamily(familyId))) {
    return {
      reason: "Kassalapp er ikke koblet til for denne familien.",
      status: "unavailable",
    };
  }

  const apiToken = await getFamilyKassalappApiToken(familyId);

  if (!apiToken) {
    return {
      reason: "Kassalapp er ikke koblet til for denne familien.",
      status: "unavailable",
    };
  }

  const uncheckedItems = getUncheckedShoppingItems(items);
  const groupedTerms = dedupeShoppingSearchTerms(uncheckedItems);
  const meta = {
    bulkCalls: 0,
    cachedHits: 0,
    searchCalls: 0,
  };

  const matchedTerms = new Map<string, MatchedSearchTerm>();

  for (const searchTerm of groupedTerms.keys()) {
    const cachedProduct = getCachedSearchResult<KassalappProduct | null>(searchTerm);

    if (cachedProduct !== undefined) {
      meta.cachedHits += 1;
      matchedTerms.set(searchTerm, {
        ean: cachedProduct?.ean ?? null,
        product: cachedProduct,
        searchTerm,
      });
      continue;
    }

    const response = await searchKassalappProducts({
      apiToken,
      fetchImpl,
      rateLimitKey: familyId,
      search: searchTerm,
    });
    meta.searchCalls += 1;

    const product = pickBestProductMatch(searchTerm, response.data);
    setCachedSearchResult(searchTerm, product);

    matchedTerms.set(searchTerm, {
      ean: product?.ean ?? null,
      product,
      searchTerm,
    });
  }

  const eansToLookup = [
    ...new Set(
      [...matchedTerms.values()]
        .map((match) => match.ean)
        .filter((ean): ean is string => Boolean(ean)),
    ),
  ];

  const bulkPricesByEan = await loadBulkPricesByEan({
    apiToken,
    eans: eansToLookup,
    familyId,
    fetchImpl,
    meta,
    storeCodes,
  });

  const termLookups = new Map<string, TermPriceLookup>();

  for (const [searchTerm, match] of matchedTerms.entries()) {
    termLookups.set(searchTerm, {
      ean: match.ean,
      pricesByStore: match.ean
        ? (bulkPricesByEan.get(match.ean) ?? {})
        : extractPricesFromProduct(match.product, storeCodes),
      product: match.product,
      searchTerm,
    });
  }

  const storeTotals = initializeStoreTotals(storeCodes);
  const unmatchedItems: Array<{ name: string; sourceKey: string }> = [];
  const itemMatches: Array<{
    ean: string | null;
    pricesByStore: Partial<Record<KassalappStoreCode, number>>;
    searchTerm: string;
    sourceKey: string;
  }> = [];

  for (const item of uncheckedItems) {
    const searchTerm = normalizeShoppingSearchTerm(item.name, item.quantityLabel);
    const lookup = searchTerm ? termLookups.get(searchTerm) : undefined;

    if (!searchTerm || !lookup?.product) {
      unmatchedItems.push({
        name: item.name,
        sourceKey: item.sourceKey,
      });

      for (const storeTotal of storeTotals) {
        storeTotal.unmatchedCount += 1;
      }

      continue;
    }

    itemMatches.push({
      ean: lookup.ean,
      pricesByStore: lookup.pricesByStore,
      searchTerm,
      sourceKey: item.sourceKey,
    });

    for (const storeTotal of storeTotals) {
      const price = lookup.pricesByStore[storeTotal.code];

      if (price === undefined) {
        storeTotal.unmatchedCount += 1;
        continue;
      }

      storeTotal.matchedCount += 1;
      storeTotal.total += price;
    }
  }

  return {
    itemMatches,
    meta,
    status: "ok",
    stores: storeTotals.map((storeTotal) => ({
      ...storeTotal,
      total: roundCurrency(storeTotal.total),
    })),
    unmatchedItems,
  };
}

async function loadBulkPricesByEan({
  apiToken,
  eans,
  familyId,
  fetchImpl,
  meta,
  storeCodes,
}: {
  apiToken: string;
  eans: string[];
  familyId: string;
  fetchImpl?: typeof fetch;
  meta: { bulkCalls: number; cachedHits: number };
  storeCodes: readonly KassalappStoreCode[];
}) {
  const bulkPricesByEan = new Map<string, Partial<Record<KassalappStoreCode, number>>>();
  const uncachedEans: string[] = [];

  for (const ean of eans) {
    const cached = getCachedBulkPriceResult<
      Partial<Record<KassalappStoreCode, number>>
    >(ean);

    if (cached) {
      meta.cachedHits += 1;
      bulkPricesByEan.set(ean, cached);
      continue;
    }

    uncachedEans.push(ean);
  }

  for (let index = 0; index < uncachedEans.length; index += BULK_EAN_BATCH_SIZE) {
    const batch = uncachedEans.slice(index, index + BULK_EAN_BATCH_SIZE);
    const response = await getKassalappBulkPrices({
      apiToken,
      eans: batch,
      fetchImpl,
      rateLimitKey: familyId,
    });
    meta.bulkCalls += 1;

    const itemsByEan = new Map(
      response.data.map((item) => [item.ean, item] as const),
    );

    for (const ean of batch) {
      const item = itemsByEan.get(ean);
      const prices = item
        ? extractPricesFromBulkItem(item, storeCodes)
        : {};
      setCachedBulkPriceResult(ean, prices);
      bulkPricesByEan.set(ean, prices);
    }
  }

  return bulkPricesByEan;
}

function extractPricesFromBulkItem(
  item: KassalappBulkPriceHistoryItem,
  storeCodes: readonly KassalappStoreCode[],
) {
  const allowedStoreCodes = new Set(storeCodes);
  const prices: Partial<Record<KassalappStoreCode, number>> = {};

  for (const storePrice of item.stores) {
    if (
      !isKassalappStoreCode(storePrice.store) ||
      !allowedStoreCodes.has(storePrice.store) ||
      storePrice.current_price === null
    ) {
      continue;
    }

    prices[storePrice.store] = storePrice.current_price;
  }

  return prices;
}

function extractPricesFromProduct(
  product: KassalappProduct | null,
  storeCodes: readonly KassalappStoreCode[],
) {
  if (!product || product.current_price === null) {
    return {};
  }

  const allowedStoreCodes = new Set(storeCodes);
  const prices: Partial<Record<KassalappStoreCode, number>> = {};

  for (const store of product.store) {
    if (
      !isKassalappStoreCode(store.code) ||
      !allowedStoreCodes.has(store.code)
    ) {
      continue;
    }

    prices[store.code] = product.current_price;
  }

  return prices;
}

function initializeStoreTotals(storeCodes: readonly KassalappStoreCode[]) {
  return storeCodes.map((code) => ({
    code,
    matchedCount: 0,
    name: KASSALAPP_STORE_DISPLAY_NAMES[code],
    total: 0,
    unmatchedCount: 0,
  }));
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
