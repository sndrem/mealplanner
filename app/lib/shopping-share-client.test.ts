// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import {
  buildShoppingShareChecksStorageKey,
  buildShoppingShareStoreStorageKey,
  readShoppingShareCheckedIds,
  readShoppingShareSelectedStoreId,
  writeShoppingShareCheckedIds,
  writeShoppingShareSelectedStoreId,
} from "./shopping-share-client";

const token = "share-token-1";
const checksKey = buildShoppingShareChecksStorageKey(token);
const storeKey = buildShoppingShareStoreStorageKey(token);

describe("shopping-share-client", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("builds isolated storage keys per token", () => {
    expect(buildShoppingShareChecksStorageKey("a")).not.toBe(
      buildShoppingShareChecksStorageKey("b"),
    );
    expect(buildShoppingShareStoreStorageKey("a")).not.toBe(
      buildShoppingShareStoreStorageKey("b"),
    );
  });

  it("persists and reads checked ids", () => {
    writeShoppingShareCheckedIds(checksKey, ["FAMILY:milk", "GENERATED:eggs"]);

    expect(readShoppingShareCheckedIds(checksKey)).toEqual([
      "FAMILY:milk",
      "GENERATED:eggs",
    ]);
  });

  it("clears storage when the checked list is empty", () => {
    writeShoppingShareCheckedIds(checksKey, ["FAMILY:milk"]);
    writeShoppingShareCheckedIds(checksKey, []);

    expect(window.localStorage.getItem(checksKey)).toBeNull();
    expect(readShoppingShareCheckedIds(checksKey)).toEqual([]);
  });

  it("returns an empty list for corrupt checked JSON", () => {
    window.localStorage.setItem(checksKey, "{not-json");

    expect(readShoppingShareCheckedIds(checksKey)).toEqual([]);
  });

  it("persists and reads the selected store", () => {
    writeShoppingShareSelectedStoreId(storeKey, "store-rema");

    expect(readShoppingShareSelectedStoreId(storeKey)).toBe("store-rema");
  });

  it("returns null for a missing selected store", () => {
    expect(readShoppingShareSelectedStoreId(storeKey)).toBeNull();
  });
});
