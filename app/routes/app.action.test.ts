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
import { createFamilyForUser, joinFamilyByCode } from "../lib/family.server";
import { action } from "./app";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(formData: FormData) {
  return new Request("http://localhost/app", {
    body: formData,
    method: "POST",
  });
}

describe("app route action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns onboarding validation errors when a family name is missing", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);

    const formData = new FormData();
    formData.set("intent", "create-family");
    formData.set("familyName", "");
    const request = buildRequest(formData);

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

  it("creates a family and redirects with an explicit success notice", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(createFamilyForUser).mockResolvedValue({
      id: "family-1",
      joinCode: "ABC123",
      name: "Solberg",
    });

    const formData = new FormData();
    formData.set("intent", "create-family");
    formData.set("familyName", "Solberg");

    const result = await action({
      params: {},
      request: buildRequest(formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(createFamilyForUser).toHaveBeenCalledWith({
      name: "Solberg",
      userId: "user-1",
    });
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("http://localhost/app?notice=family-created");
  });

  it("returns onboarding validation errors when a join code is missing", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);

    const formData = new FormData();
    formData.set("intent", "join-family");
    formData.set("joinCode", "");

    const result = await action({
      params: {},
      request: buildRequest(formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toMatchObject({
      fieldErrors: {
        joinCode: "Skriv inn familiekoden.",
      },
      intent: "join-family",
    });
    expect(joinFamilyByCode).not.toHaveBeenCalled();
  });

  it("returns a form error when the join code does not match a family", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(joinFamilyByCode).mockResolvedValue({
      status: "NOT_FOUND",
    });

    const formData = new FormData();
    formData.set("intent", "join-family");
    formData.set("joinCode", "ABC123");

    const result = await action({
      params: {},
      request: buildRequest(formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(joinFamilyByCode).toHaveBeenCalledWith({
      joinCode: "ABC123",
      userId: "user-1",
    });
    expect(result).toMatchObject({
      formError: "Fant ingen familie med denne koden.",
      intent: "join-family",
      values: {
        joinCode: "ABC123",
      },
    });
  });

  it("redirects with an explicit notice when the user is already a member", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(joinFamilyByCode).mockResolvedValue({
      status: "ALREADY_MEMBER",
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
    });

    const formData = new FormData();
    formData.set("intent", "join-family");
    formData.set("joinCode", "ABC123");

    const result = await action({
      params: {},
      request: buildRequest(formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("http://localhost/app?notice=family-already-member");
  });

  it("redirects with an explicit success notice when a family is joined", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(joinFamilyByCode).mockResolvedValue({
      status: "JOINED",
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
    });

    const formData = new FormData();
    formData.set("intent", "join-family");
    formData.set("joinCode", "ABC123");

    const result = await action({
      params: {},
      request: buildRequest(formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("http://localhost/app?notice=family-joined");
  });
});
