import { describe, expect, it } from "vitest";

import { storeModePageClass } from "./store-mode-theme";
import {
  getStoreModePageClass,
  resolveShowCategoryHeadings,
  resolveStoreModePendingNavigation,
  resolveStoreModeScanState,
} from "./store-mode-route-state";

describe("store mode route state", () => {
  it("pads the page when the undo bar and celebration are both visible", () => {
    expect(
      getStoreModePageClass({
        isCelebrating: true,
        showUndoBar: true,
      }),
    ).toBe(storeModePageClass.replace("pb-36", "pb-64"));
    expect(
      getStoreModePageClass({
        isCelebrating: false,
        showUndoBar: true,
      }),
    ).toBe(storeModePageClass.replace("pb-36", "pb-52"));
    expect(
      getStoreModePageClass({
        isCelebrating: false,
        showUndoBar: false,
      }),
    ).toBe(storeModePageClass);
  });

  it("keeps a saved category heading choice after the fetcher settles without a reload", () => {
    expect(
      resolveShowCategoryHeadings({
        categoryHeadingsFetcher: {
          data: {
            intent: "update-show-category-headings",
            ok: true,
            showCategoryHeadings: false,
          },
          state: "idle",
        },
        showCategoryHeadings: true,
      }),
    ).toBe(false);
  });

  it("tracks the in-flight mark-as-stock row without treating a saving store select as idle", () => {
    const formData = new FormData();
    formData.set("intent", "mark-generated-shopping-item-as-stock");
    formData.set("sourceKey", "generated-1");

    expect(
      resolveStoreModePendingNavigation({
        formData,
        state: "submitting",
      }),
    ).toMatchObject({
      isSavingStore: false,
      pendingMarkAsStockSourceKey: "generated-1",
    });
  });

  it("shows the in-flight store name before the action returns", () => {
    const formData = new FormData();
    formData.set("intent", "update-selected-store");
    formData.set("selectedStoreId", "store-2");

    expect(
      resolveStoreModeScanState({
        effectiveTripFocus: "CURRENT",
        navigation: {
          formData,
          state: "submitting",
        },
        selectedStore: {
          id: "store-1",
          name: "Meny",
        },
        stores: [
          { id: "store-1", name: "Meny" },
          { id: "store-2", name: "Kiwi" },
        ],
      }).scanStoreName,
    ).toBe("Kiwi");
  });
});
