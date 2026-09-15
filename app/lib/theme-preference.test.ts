// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import {
  applyThemeHtmlClass,
  getThemeHtmlClass,
  parseThemePreference,
  resolveThemePreference,
} from "./theme-preference";

describe("theme-preference", () => {
  afterEach(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("system", "light", "dark");
    }
  });

  it("parses valid theme preferences", () => {
    expect(parseThemePreference("SYSTEM")).toBe("SYSTEM");
    expect(parseThemePreference("LIGHT")).toBe("LIGHT");
    expect(parseThemePreference("DARK")).toBe("DARK");
    expect(parseThemePreference("INVALID")).toBeNull();
    expect(parseThemePreference(null)).toBeNull();
  });

  it("resolves missing values to system", () => {
    expect(resolveThemePreference(undefined)).toBe("SYSTEM");
    expect(resolveThemePreference("DARK")).toBe("DARK");
    expect(resolveThemePreference("nope")).toBe("SYSTEM");
  });

  it("maps preferences to html classes", () => {
    expect(getThemeHtmlClass("SYSTEM")).toBe("system");
    expect(getThemeHtmlClass("LIGHT")).toBe("light");
    expect(getThemeHtmlClass("DARK")).toBe("dark");
    expect(getThemeHtmlClass(undefined)).toBe("system");
  });
});

describe("applyThemeHtmlClass", () => {
  it("replaces the html theme class", () => {
    document.documentElement.classList.add("system");
    applyThemeHtmlClass("DARK");

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("system")).toBe(false);
  });
});
