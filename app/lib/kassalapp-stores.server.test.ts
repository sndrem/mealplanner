import { describe, expect, it } from "vitest";

import {
  isKassalappStoreCode,
  resolveKassalappCodeFromStoreKey,
} from "./kassalapp-stores.server";

describe("kassalapp-stores.server", () => {
  it("resolves known store keys to Kassalapp codes", () => {
    expect(resolveKassalappCodeFromStoreKey("kiwi")).toBe("KIWI");
    expect(resolveKassalappCodeFromStoreKey("rema-1000")).toBe("REMA_1000");
  });

  it("validates supported store codes", () => {
    expect(isKassalappStoreCode("KIWI")).toBe(true);
    expect(isKassalappStoreCode("UNKNOWN")).toBe(false);
  });
});
