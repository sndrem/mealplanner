import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    requireAnonymous: vi.fn(),
  };
});

vi.mock("../lib/password-reset.server", () => {
  return {
    requestPasswordReset: vi.fn(),
  };
});

import { requireAnonymous } from "../lib/auth.server";
import { requestPasswordReset } from "../lib/password-reset.server";
import { action, loader } from "./forgot-password";

describe("forgot-password route loader", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("forces authenticated users away before rendering the form", async () => {
    const redirectResponse = new Response(null, {
      headers: {
        Location: "/app",
      },
      status: 302,
    });
    vi.mocked(requireAnonymous).mockRejectedValue(redirectResponse);

    await expect(
      loader({
        context: {} as never,
        params: {},
        request: new Request("http://localhost/forgot-password"),
      } as unknown as Parameters<typeof loader>[0]),
    ).rejects.toBe(redirectResponse);
  });
});

describe("forgot-password route action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a field error when email is missing", async () => {
    vi.mocked(requireAnonymous).mockResolvedValue(undefined);

    const result = await action({
      context: {} as never,
      params: {},
      request: new Request("http://localhost/forgot-password", {
        body: new FormData(),
        method: "POST",
      }),
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toMatchObject({
      fieldErrors: {
        email: "Skriv inn e-postadressen din.",
      },
    });
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("returns generic success for any submitted email", async () => {
    vi.mocked(requireAnonymous).mockResolvedValue(undefined);
    vi.mocked(requestPasswordReset).mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("email", "unknown@example.com");

    const result = await action({
      context: {} as never,
      params: {},
      request: new Request("http://localhost/forgot-password", {
        body: formData,
        method: "POST",
      }),
    } as unknown as Parameters<typeof action>[0]);

    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "unknown@example.com",
      origin: "http://localhost",
    });
    expect(result).toEqual({
      success: true,
    });
  });
});
