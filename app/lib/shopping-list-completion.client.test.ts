import { describe, expect, it } from "vitest";

import {
  detectShoppingListJustCompleted,
  getUncheckedCount,
} from "./shopping-list-completion.client";

describe("shopping-list-completion.client", () => {
  describe("getUncheckedCount", () => {
    it("returns remaining unchecked items", () => {
      expect(getUncheckedCount({ checkedCount: 2, totalCount: 5 })).toBe(3);
    });

    it("never returns a negative count", () => {
      expect(getUncheckedCount({ checkedCount: 6, totalCount: 5 })).toBe(0);
    });
  });

  describe("detectShoppingListJustCompleted", () => {
    it("detects the transition from incomplete to complete", () => {
      expect(
        detectShoppingListJustCompleted(
          { checkedCount: 2, totalCount: 3 },
          { checkedCount: 3, totalCount: 3 },
        ),
      ).toBe(true);
    });

    it("does not fire on first render", () => {
      expect(
        detectShoppingListJustCompleted(null, {
          checkedCount: 3,
          totalCount: 3,
        }),
      ).toBe(false);
    });

    it("does not fire for empty lists", () => {
      expect(
        detectShoppingListJustCompleted(
          { checkedCount: 0, totalCount: 0 },
          { checkedCount: 0, totalCount: 0 },
        ),
      ).toBe(false);
    });

    it("does not fire when the list was already complete", () => {
      expect(
        detectShoppingListJustCompleted(
          { checkedCount: 3, totalCount: 3 },
          { checkedCount: 3, totalCount: 3 },
        ),
      ).toBe(false);
    });

    it("does not fire when unchecking items", () => {
      expect(
        detectShoppingListJustCompleted(
          { checkedCount: 3, totalCount: 3 },
          { checkedCount: 2, totalCount: 3 },
        ),
      ).toBe(false);
    });

    it("does not fire when checking items without finishing", () => {
      expect(
        detectShoppingListJustCompleted(
          { checkedCount: 0, totalCount: 3 },
          { checkedCount: 1, totalCount: 3 },
        ),
      ).toBe(false);
    });
  });
});
