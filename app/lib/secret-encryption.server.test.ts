import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./secret-encryption.server";

describe("secret-encryption.server", () => {
  it("encrypts and decrypts secrets", () => {
    const encrypted = encryptSecret("my-kassalapp-token");

    expect(encrypted).not.toContain("my-kassalapp-token");
    expect(decryptSecret(encrypted)).toBe("my-kassalapp-token");
  });
});
