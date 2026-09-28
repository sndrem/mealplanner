import { webcrypto } from "node:crypto";

import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

function ensureLocalStorage() {
  const existing = globalThis.localStorage;
  if (existing && typeof existing.getItem === "function") {
    return;
  }

  const store = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(String(key)) ?? null;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorage,
  });

  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorage,
    });
  }
}

ensureLocalStorage();

afterEach(() => {
  cleanup();
});
