import { describe, expect, it } from "vitest";

import {
  getStoreModeBannerClass,
  getStoreModeSyncOverlayClass,
  storeModeMetaDateSelectClass,
  storeModeMetaStoreSelectClass,
  storeModeSelectClass,
  storeModeSyncOverlayShellClass,
} from "./store-mode-theme";

describe("store-mode-theme", () => {
  it("returns distinct banner classes per tone", () => {
    const success = getStoreModeBannerClass("success");
    const sync = getStoreModeBannerClass("sync");
    const error = getStoreModeBannerClass("error");

    expect(success).toContain("emerald");
    expect(sync).toContain("amber");
    expect(error).toContain("rose");
    expect(success).not.toBe(sync);
  });

  it("returns compact fixed overlay classes for sync and error", () => {
    const sync = getStoreModeSyncOverlayClass("sync");
    const error = getStoreModeSyncOverlayClass("error");

    expect(storeModeSyncOverlayShellClass).toContain("fixed");
    expect(storeModeSyncOverlayShellClass).toContain("pointer-events-none");
    expect(sync).toContain("amber");
    expect(error).toContain("rose");
    expect(sync).not.toBe(error);
    expect(sync).not.toContain("py-5");
  });

  it("uses compact auto-width meta selects distinct from full-width selects", () => {
    expect(storeModeMetaStoreSelectClass).toContain("w-auto");
    expect(storeModeMetaStoreSelectClass).not.toContain("w-full");
    expect(storeModeMetaDateSelectClass).toContain("max-w-[9rem]");
    expect(storeModeSelectClass).toContain("w-full");
  });
});
