import { describe, expect, it } from "vitest";

import {
  computeFreezerStockDelta,
  validateFreezerStockDelta,
} from "./freezer-stock.server";

describe("freezer-stock.server", () => {
  it("consumes stock when assigning a freezer item", () => {
    const delta = computeFreezerStockDelta({
      nextEntries: new Map([["2026-06-02", "freezer-1"]]),
      previousEntries: new Map([["2026-06-02", null]]),
    });

    expect(delta.get("freezer-1")).toBe(-1);
  });

  it("restores stock when clearing a freezer assignment", () => {
    const delta = computeFreezerStockDelta({
      nextEntries: new Map([["2026-06-02", null]]),
      previousEntries: new Map([["2026-06-02", "freezer-1"]]),
    });

    expect(delta.get("freezer-1")).toBe(1);
  });

  it("swaps stock when changing freezer items", () => {
    const delta = computeFreezerStockDelta({
      nextEntries: new Map([["2026-06-02", "freezer-2"]]),
      previousEntries: new Map([["2026-06-02", "freezer-1"]]),
    });

    expect(delta.get("freezer-1")).toBe(1);
    expect(delta.get("freezer-2")).toBe(-1);
  });

  it("decrements once per day when the same item is assigned to multiple days", () => {
    const delta = computeFreezerStockDelta({
      nextEntries: new Map([
        ["2026-06-02", "freezer-1"],
        ["2026-06-03", "freezer-1"],
      ]),
      previousEntries: new Map([
        ["2026-06-02", null],
        ["2026-06-03", null],
      ]),
    });

    expect(delta.get("freezer-1")).toBe(-2);
  });

  it("restores all stock when resetting every assignment", () => {
    const delta = computeFreezerStockDelta({
      nextEntries: new Map([
        ["2026-06-02", null],
        ["2026-06-03", null],
      ]),
      previousEntries: new Map([
        ["2026-06-02", "freezer-1"],
        ["2026-06-03", "freezer-2"],
      ]),
    });

    expect(delta.get("freezer-1")).toBe(1);
    expect(delta.get("freezer-2")).toBe(1);
  });

  it("rejects stock deltas that would go below zero", () => {
    const result = validateFreezerStockDelta({
      currentQuantities: new Map([["freezer-1", 1]]),
      deltaByItemId: new Map([["freezer-1", -2]]),
    });

    expect(result.status).toBe("INSUFFICIENT_STOCK");
    expect(result.formError).toBeTruthy();
  });
});
