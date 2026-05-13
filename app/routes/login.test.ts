import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    loginUser: vi.fn(),
    requireAnonymous: vi.fn(),
    signInUser: vi.fn(),
  };
});

import { loginUser, requireAnonymous, signInUser } from "../lib/auth.server";
import { action } from "./login";

describe("login route action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns field errors when required fields are missing", async () => {
    const request = new Request("http://localhost/login", {
      body: new FormData(),
      method: "POST",
    });

    const result = await action({
      params: {},
      request,
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toMatchObject({
      fieldErrors: {
        email: "Skriv inn e-postadressen din.",
        password: "Skriv inn passordet ditt.",
      },
    });
    expect(loginUser).not.toHaveBeenCalled();
  });

  it("returns a form error when credentials are invalid", async () => {
    vi.mocked(requireAnonymous).mockResolvedValue(undefined);
    vi.mocked(loginUser).mockResolvedValue(null);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "wrong-password");
    formData.set("redirectTo", "/app");

    const request = new Request("http://localhost/login", {
      body: formData,
      method: "POST",
    });

    const result = await action({
      params: {},
      request,
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toMatchObject({
      formError: "Feil e-post eller passord.",
      values: {
        email: "test@example.com",
      },
    });
  });

  it("creates a session and redirects on successful login", async () => {
    const redirectResponse = new Response(null, {
      headers: {
        Location: "/app",
      },
      status: 302,
    });

    vi.mocked(requireAnonymous).mockResolvedValue(undefined);
    vi.mocked(loginUser).mockResolvedValue({
      displayName: "Test",
      email: "test@example.com",
      id: "user-1",
      isGlobalAdmin: false,
    });
    vi.mocked(signInUser).mockResolvedValue(redirectResponse);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "correct-password");
    formData.set("redirectTo", "/app");

    const request = new Request("http://localhost/login", {
      body: formData,
      method: "POST",
    });

    const result = await action({
      params: {},
      request,
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(signInUser).toHaveBeenCalledWith({
      redirectTo: "/app",
      request,
      userId: "user-1",
    });
    expect(result).toBe(redirectResponse);
  });
});
