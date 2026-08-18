import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    requireAnonymous: vi.fn(),
    signInUser: vi.fn(),
  };
});

vi.mock("../lib/password-reset.server", () => {
  return {
    getValidPasswordResetToken: vi.fn(),
    resetPasswordWithToken: vi.fn(),
  };
});

import { requireAnonymous, signInUser } from "../lib/auth.server";
import { getValidPasswordResetToken, resetPasswordWithToken } from "../lib/password-reset.server";
import { action, loader } from "./reset-password";

describe("reset-password route loader", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("marks missing tokens as invalid", async () => {
    vi.mocked(requireAnonymous).mockResolvedValue(undefined);
    vi.mocked(getValidPasswordResetToken).mockResolvedValue(null);

    const result = await loader({
      context: {} as never,
      params: {},
      request: new Request("http://localhost/reset-password"),
    } as unknown as Parameters<typeof loader>[0]);

    expect(getValidPasswordResetToken).toHaveBeenCalledWith("");
    expect(result).toEqual({
      isValid: false,
      token: "",
    });
  });

  it("returns a valid token from the query string", async () => {
    vi.mocked(requireAnonymous).mockResolvedValue(undefined);
    vi.mocked(getValidPasswordResetToken).mockResolvedValue({
      expiresAt: new Date("2026-08-18T20:00:00.000Z"),
      id: "token-1",
      usedAt: null,
      userId: "user-1",
    });

    const result = await loader({
      context: {} as never,
      params: {},
      request: new Request("http://localhost/reset-password?token=raw-token"),
    } as unknown as Parameters<typeof loader>[0]);

    expect(result).toEqual({
      isValid: true,
      token: "raw-token",
    });
  });
});

describe("reset-password route action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a field error when the password is too short", async () => {
    vi.mocked(requireAnonymous).mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("token", "raw-token");
    formData.set("password", "kort");

    const result = await action({
      context: {} as never,
      params: {},
      request: new Request("http://localhost/reset-password", {
        body: formData,
        method: "POST",
      }),
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toMatchObject({
      fieldErrors: {
        password: "Passordet må ha minst 8 tegn.",
      },
      token: "raw-token",
    });
    expect(resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("returns a form error for an expired or reused token", async () => {
    vi.mocked(requireAnonymous).mockResolvedValue(undefined);
    vi.mocked(resetPasswordWithToken).mockResolvedValue({ error: "INVALID_TOKEN" });

    const formData = new FormData();
    formData.set("token", "raw-token");
    formData.set("password", "nytt-passord");

    const result = await action({
      context: {} as never,
      params: {},
      request: new Request("http://localhost/reset-password", {
        body: formData,
        method: "POST",
      }),
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toMatchObject({
      formError: "Lenken er ugyldig eller utløpt. Be om en ny lenke og prøv igjen.",
    });
    expect(signInUser).not.toHaveBeenCalled();
  });

  it("signs the user in after a successful reset", async () => {
    const redirectResponse = new Response(null, {
      headers: {
        Location: "/app",
      },
      status: 302,
    });

    vi.mocked(requireAnonymous).mockResolvedValue(undefined);
    vi.mocked(resetPasswordWithToken).mockResolvedValue({ userId: "user-1" });
    vi.mocked(signInUser).mockResolvedValue(redirectResponse);

    const formData = new FormData();
    formData.set("token", "raw-token");
    formData.set("password", "nytt-passord");

    const request = new Request("http://localhost/reset-password", {
      body: formData,
      method: "POST",
    });
    const result = await action({
      context: {} as never,
      params: {},
      request,
    } as unknown as Parameters<typeof action>[0]);

    expect(resetPasswordWithToken).toHaveBeenCalledWith({
      password: "nytt-passord",
      rawToken: "raw-token",
    });
    expect(signInUser).toHaveBeenCalledWith({
      redirectTo: "/app",
      request,
      userId: "user-1",
    });
    expect(result).toBe(redirectResponse);
  });
});
