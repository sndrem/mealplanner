import { describe, expect, it } from "vitest";

import { getStoreModeBannerClass } from "./store-mode-theme";

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
});
