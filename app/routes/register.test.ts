import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    registerUser: vi.fn(),
    requireAnonymous: vi.fn(),
    signInUser: vi.fn(),
  };
});

import { registerUser, requireAnonymous, signInUser } from "../lib/auth.server";
import { action } from "./register";

describe("register route action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns field errors when the form is incomplete", async () => {
    const request = new Request("http://localhost/register", {
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
        displayName: "Skriv inn navnet ditt.",
        email: "Skriv inn e-postadressen din.",
        password: "Passordet ma ha minst 8 tegn.",
      },
    });
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("returns a form error when the email address is already registered", async () => {
    vi.mocked(requireAnonymous).mockResolvedValue(undefined);
    vi.mocked(registerUser).mockResolvedValue({ error: "EMAIL_TAKEN" });

    const formData = new FormData();
    formData.set("displayName", "Ola");
    formData.set("email", "ola@example.com");
    formData.set("password", "sterkt-passord");
    formData.set("redirectTo", "/app");

    const request = new Request("http://localhost/register", {
      body: formData,
      method: "POST",
    });

    const result = await action({
      params: {},
      request,
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toMatchObject({
      formError: "Det finnes allerede en konto med denne e-postadressen.",
      values: {
        displayName: "Ola",
        email: "ola@example.com",
      },
    });
  });

  it("creates a session and redirects after successful registration", async () => {
    const redirectResponse = new Response(null, {
      headers: {
        Location: "/app",
      },
      status: 302,
    });

    vi.mocked(requireAnonymous).mockResolvedValue(undefined);
    vi.mocked(registerUser).mockResolvedValue({
      user: {
        displayName: "Ola",
        email: "ola@example.com",
        id: "user-1",
        isGlobalAdmin: false,
      },
    });
    vi.mocked(signInUser).mockResolvedValue(redirectResponse);

    const formData = new FormData();
    formData.set("displayName", "Ola");
    formData.set("email", "ola@example.com");
    formData.set("password", "sterkt-passord");
    formData.set("redirectTo", "/app");

    const request = new Request("http://localhost/register", {
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
