import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/family.server", () => {
  return {
    createFamilyForUser: vi.fn(),
    getFamilyMembershipsForUser: vi.fn(),
    joinFamilyByCode: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { createFamilyForUser } from "../lib/family.server";
import { action } from "./app";

describe("app route action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns onboarding validation errors when a family name is missing", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      displayName: "Ola",
      email: "ola@example.com",
      id: "user-1",
      isGlobalAdmin: false,
    });

    const formData = new FormData();
    formData.set("intent", "create-family");
    formData.set("familyName", "");

    const request = new Request("http://localhost/app", {
      body: formData,
      method: "POST",
    });

    const result = await action({
      params: {},
      request,
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toMatchObject({
      fieldErrors: {
        familyName: "Skriv inn et familienavn.",
      },
      intent: "create-family",
    });
    expect(createFamilyForUser).not.toHaveBeenCalled();
  });
});
