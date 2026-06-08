import type { ProjectedShoppingItem } from "./shopping.server";

const QUANTITY_PREFIX_PATTERN =
  /^(?:\d+(?:[.,]\d+)?\s*(?:stk|ss|ts|dl|cl|ml|l|g|kg|hg|mg|pk|pakke|boks|pose|kopp|neve|fedd)\.?\s+)+/i;

const STANDALONE_QUANTITY_PATTERN =
  /^\d+(?:[.,]\d+)?\s*(?:stk|ss|ts|dl|cl|ml|l|g|kg|hg|mg|pk|pakke|boks|pose|kopp|neve|fedd)\.?$/i;

function isStandaloneQuantity(value: string) {
  return STANDALONE_QUANTITY_PATTERN.test(value.trim());
}

export function normalizeShoppingSearchTerm(
  name: string,
  quantityLabel?: string | null,
) {
  const normalizedName = stripQuantityPrefix(name.trim());
  const candidate =
    normalizedName.length >= 3 && !isStandaloneQuantity(normalizedName)
      ? normalizedName
      : stripQuantityPrefix((quantityLabel ?? "").trim());

  const cleaned = candidate.trim().toLowerCase();

  if (cleaned.length < 3 || isStandaloneQuantity(cleaned)) {
    return null;
  }

  return cleaned;
}

function stripQuantityPrefix(value: string) {
  let current = value.trim();

  while (QUANTITY_PREFIX_PATTERN.test(current)) {
    current = current.replace(QUANTITY_PREFIX_PATTERN, "").trim();
  }

  return current;
}

export function dedupeShoppingSearchTerms(items: ProjectedShoppingItem[]) {
  const groupedTerms = new Map<string, ProjectedShoppingItem[]>();

  for (const item of items) {
    const searchTerm = normalizeShoppingSearchTerm(item.name, item.quantityLabel);

    if (!searchTerm) {
      continue;
    }

    const existingItems = groupedTerms.get(searchTerm) ?? [];
    existingItems.push(item);
    groupedTerms.set(searchTerm, existingItems);
  }

  return groupedTerms;
}

export function getUncheckedShoppingItems(items: ProjectedShoppingItem[]) {
  return items.filter((item) => !item.checked);
}
