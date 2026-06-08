import type { KassalappProduct } from "./kassalapp.types";

function normalizeProductName(name: string) {
  return name.trim().toLowerCase();
}

function scoreProductMatch(searchTerm: string, product: KassalappProduct) {
  const normalizedProductName = normalizeProductName(product.name);
  let score = 0;

  if (normalizedProductName === searchTerm) {
    score += 100;
  } else if (normalizedProductName.startsWith(searchTerm)) {
    score += 60;
  } else if (normalizedProductName.includes(searchTerm)) {
    score += 30;
  } else {
    return null;
  }

  if (product.ean) {
    score += 10;
  }

  if (product.current_price !== null) {
    score += 5;
  }

  return score;
}

export function pickBestProductMatch(
  searchTerm: string,
  results: KassalappProduct[],
) {
  let bestProduct: KassalappProduct | null = null;
  let bestScore = -1;

  for (const product of results) {
    const score = scoreProductMatch(searchTerm, product);

    if (score === null || score < bestScore) {
      continue;
    }

    if (score > bestScore) {
      bestProduct = product;
      bestScore = score;
      continue;
    }

    if (
      score === bestScore &&
      bestProduct &&
      product.name.localeCompare(bestProduct.name, "nb") < 0
    ) {
      bestProduct = product;
    }
  }

  return bestProduct;
}
