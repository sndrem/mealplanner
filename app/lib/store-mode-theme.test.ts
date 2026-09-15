import { describe, expect, it } from "vitest";

import {
  getStoreModeBannerClass,
  getStoreModeSyncOverlayClass,
  storeModeBottomChromeShellClass,
  storeModeMetaDateSelectClass,
  storeModeMetaStoreSelectClass,
  storeModeMetaTripFocusSelectClass,
  storeModePageClass,
  storeModeSelectClass,
  storeModeSyncOverlayShellClass,
  storeModeUndoBarActionClass,
  storeModeUndoBarClass,
  storeModeCelebrationHighlightClass,
} from "./store-mode-theme";

describe("store-mode-theme", () => {
  it("returns distinct banner classes per tone", () => {
    const success = getStoreModeBannerClass("success");
    const sync = getStoreModeBannerClass("sync");
    const error = getStoreModeBannerClass("error");

    expect(success).toContain("notice-success");
    expect(sync).toContain("notice-warning");
    expect(error).toContain("notice-danger");
    expect(success).not.toBe(sync);
  });

  it("returns compact fixed overlay classes for sync and error", () => {
    const sync = getStoreModeSyncOverlayClass("sync");
    const error = getStoreModeSyncOverlayClass("error");

    expect(storeModeSyncOverlayShellClass).toContain("fixed");
    expect(storeModeSyncOverlayShellClass).toContain("pointer-events-none");
    expect(sync).toContain("notice-warning");
    expect(error).toContain("notice-danger");
    expect(sync).not.toBe(error);
    expect(sync).not.toContain("py-5");
  });

  it("uses compact auto-width meta selects distinct from full-width selects", () => {
    expect(storeModeMetaStoreSelectClass).toContain("w-auto");
    expect(storeModeMetaStoreSelectClass).not.toContain("w-full");
    expect(storeModeMetaDateSelectClass).toContain("max-w-[9rem]");
    expect(storeModeMetaTripFocusSelectClass).toContain("max-w-[10rem]");
    expect(storeModeSelectClass).toContain("w-full");
  });

  it("exposes thumb-friendly bottom undo chrome", () => {
    expect(storeModeBottomChromeShellClass).toContain("fixed");
    expect(storeModeBottomChromeShellClass).toContain("bottom-0");
    expect(storeModeUndoBarClass).toContain("min-h-11");
    expect(storeModeUndoBarActionClass).toContain("min-h-11");
  });

  it("uses store tokens for page and surface chrome", () => {
    expect(storeModePageClass).toContain("bg-store-bg");
    expect(storeModePageClass).toContain("text-store-ink");
    expect(storeModeUndoBarClass).toContain("bg-store-surface");
  });

  it("uses notice tokens for the celebration highlight", () => {
    expect(storeModeCelebrationHighlightClass).toContain("notice-success");
  });
});
