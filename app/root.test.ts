import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/theme-preference-write.server", () => ({
  getRequestThemePreference: vi.fn(),
}));

vi.mock("./app.css", () => ({}));

import { getRequestThemePreference } from "./lib/theme-preference-write.server";
import { loader } from "./root";

describe("root loader", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns system when the visitor is anonymous", async () => {
    vi.mocked(getRequestThemePreference).mockResolvedValue("SYSTEM");

    const result = await loader({
      params: {},
      request: new Request("http://localhost/login"),
      context: {} as never,
    } as unknown as Parameters<typeof loader>[0]);

    expect(result).toEqual({ themePreference: "SYSTEM" });
  });

  it("returns the stored preference for a signed-in user", async () => {
    vi.mocked(getRequestThemePreference).mockResolvedValue("DARK");

    const result = await loader({
      params: {},
      request: new Request("http://localhost/app"),
      context: {} as never,
    } as unknown as Parameters<typeof loader>[0]);

    expect(result).toEqual({ themePreference: "DARK" });
  });
});
