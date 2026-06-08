import { describe, expect, it } from "vitest";

import { pickBestProductMatch } from "./kassalapp-match.server";
import type { KassalappProduct } from "./kassalapp.types";

function createProduct(
  overrides: Partial<KassalappProduct> = {},
): KassalappProduct {
  return {
    brand: null,
    current_price: 20,
    current_unit_price: null,
    ean: "7039010019811",
    id: 1,
    name: "Tine Helmelk 1 liter",
    store: [],
    vendor: null,
    ...overrides,
  };
}

describe("kassalapp-match.server", () => {
  it("prefers exact name matches with EAN and price", () => {
    const match = pickBestProductMatch("tine helmelk 1 liter", [
      createProduct({ ean: null, name: "Tine Lettmelk 1 liter" }),
      createProduct({ name: "Tine Helmelk 1 liter" }),
    ]);

    expect(match?.name).toBe("Tine Helmelk 1 liter");
  });

  it("returns null when no result contains the search term", () => {
    expect(
      pickBestProductMatch("appelsin", [
        createProduct({ name: "Grandiosa Pizza" }),
      ]),
    ).toBeNull();
  });
});
