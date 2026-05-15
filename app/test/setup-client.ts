import { webcrypto } from "node:crypto";

import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

afterEach(() => {
  cleanup();
});
