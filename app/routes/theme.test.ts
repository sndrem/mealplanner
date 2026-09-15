import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>(
    "../lib/auth.server",
  );

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/theme-preference-write.server", () => ({
  updateUserThemePreference: vi.fn(),
}));

import { requireUser } from "../lib/auth.server";
import { updateUserThemePreference } from "../lib/theme-preference-write.server";
import { action, loader } from "./theme";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
  themePreference: "SYSTEM" as const,
};

describe("theme route loader", () => {
  it("redirects GET requests away from the resource route", async () => {
    await expect(loader()).rejects.toMatchObject({
      status: 302,
      headers: expect.anything(),
    });

    try {
      await loader();
    } catch (error) {
      const response = error as Response;
      expect(response.headers.get("Location")).toBe("/app");
    }
  });
});

describe("theme route action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("saves a valid theme preference for the signed-in user", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateUserThemePreference).mockResolvedValue({
      status: "UPDATED",
      themePreference: "LIGHT",
    });

    const formData = new FormData();
    formData.set("themePreference", "LIGHT");

    const result = await action({
      params: {},
      request: new Request("http://localhost/theme", {
        body: formData,
        method: "POST",
      }),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(updateUserThemePreference).toHaveBeenCalledWith({
      themePreference: "LIGHT",
      userId: "user-1",
    });
    expect(result).toEqual({
      status: "UPDATED",
      themePreference: "LIGHT",
    });
  });

  it("rejects invalid theme preferences", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);

    const formData = new FormData();
    formData.set("themePreference", "SEPIA");

    const result = await action({
      params: {},
      request: new Request("http://localhost/theme", {
        body: formData,
        method: "POST",
      }),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(updateUserThemePreference).not.toHaveBeenCalled();
    expect(result).toEqual({
      formError: "Ugyldig utseende.",
      status: "VALIDATION_ERROR",
    });
  });

  it("redirects anonymous users to login", async () => {
    const redirectResponse = new Response(null, {
      headers: {
        Location: "/login?redirectTo=%2Ftheme",
      },
      status: 302,
    });
    vi.mocked(requireUser).mockRejectedValue(redirectResponse);

    await expect(
      action({
        params: {},
        request: new Request("http://localhost/theme", {
          body: new FormData(),
          method: "POST",
        }),
        context: {} as never,
      } as unknown as Parameters<typeof action>[0]),
    ).rejects.toBe(redirectResponse);
  });
});
