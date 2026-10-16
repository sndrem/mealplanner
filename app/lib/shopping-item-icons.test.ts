import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  hasExplicitShoppingItemIcon,
  resolveShoppingItemIcon,
  shoppingItemIconLetter,
} from "./shopping-item-icons";

const catalogNames = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../prisma/data/catalog-ingredient-seeds.csv"),
  "utf8",
)
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => line.split(",")[0] ?? "");

describe("resolveShoppingItemIcon", () => {
  it("uses a diagram when the item has one, otherwise its first letter", () => {
    const unresolved = catalogNames.filter((name) => {
      const icon = resolveShoppingItemIcon({ name });

      if (icon.kind === "diagram") {
        return !hasExplicitShoppingItemIcon(name);
      }

      return icon.letter !== shoppingItemIconLetter(name);
    });

    expect(unresolved).toEqual([]);
  });

  it("shares one glyph across related names", () => {
    expect(resolveShoppingItemIcon({ name: "Tomat" })).toEqual({
      kind: "diagram",
      key: "tomato",
    });
    expect(resolveShoppingItemIcon({ name: "Cherrytomat" })).toEqual({
      kind: "diagram",
      key: "tomato",
    });
    expect(resolveShoppingItemIcon({ name: "  melk " })).toEqual({
      kind: "diagram",
      key: "milk",
    });
  });

  it("uses the item's first letter when there is no diagram", () => {
    expect(resolveShoppingItemIcon({ name: "Tacolefser" })).toEqual({
      kind: "letter",
      letter: "T",
    });
    expect(resolveShoppingItemIcon({ name: "Grillmat" })).toEqual({
      kind: "letter",
      letter: "G",
    });
    expect(resolveShoppingItemIcon({ name: "Potetgull" })).toEqual({
      kind: "letter",
      letter: "P",
    });
    expect(resolveShoppingItemIcon({ name: "Cola" })).toEqual({
      kind: "letter",
      letter: "C",
    });
    expect(resolveShoppingItemIcon({ name: "Ørret" })).toEqual({
      kind: "letter",
      letter: "Ø",
    });
    expect(
      resolveShoppingItemIcon({ categoryKey: "produce", name: "Ukjent grønt" }),
    ).toEqual({
      kind: "letter",
      letter: "U",
    });
  });
});
