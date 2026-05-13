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
    listFamilyMembers: vi.fn(),
    removeFamilyMember: vi.fn(),
    requireFamilyMembership: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { listFamilyMembers, removeFamilyMember, requireFamilyMembership } from "../lib/family.server";
import { action, loader } from "./family";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(url = "http://localhost/families/family-1", formData?: FormData) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns admin-only family data for admins", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
      familyId: "family-1",
      id: "membership-1",
      role: "ADMIN",
      userId: "user-1",
    });
    vi.mocked(listFamilyMembers).mockResolvedValue([
      {
        id: "membership-1",
        role: "ADMIN",
        user: {
          displayName: "Ola",
          email: "ola@example.com",
          id: "user-1",
        },
      },
    ]);

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1?notice=member-removed"),
      context: {} as never,
    } as unknown as Parameters<typeof loader>[0]);

    expect(requireFamilyMembership).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(listFamilyMembers).toHaveBeenCalledWith("family-1");
    expect(result).toEqual({
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
      members: [
        {
          id: "membership-1",
          role: "ADMIN",
          user: {
            displayName: "Ola",
            email: "ola@example.com",
            id: "user-1",
          },
        },
      ],
      notice: "member-removed",
      user: mockUser,
      userRole: "ADMIN",
    });
  });

  it("hides the join code and member list from regular members", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
      familyId: "family-1",
      id: "membership-2",
      role: "MEMBER",
      userId: "user-1",
    });

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(),
      context: {} as never,
    } as unknown as Parameters<typeof loader>[0]);

    expect(listFamilyMembers).not.toHaveBeenCalled();
    expect(result).toEqual({
      family: {
        id: "family-1",
        joinCode: null,
        name: "Solberg",
      },
      members: [],
      notice: null,
      user: mockUser,
      userRole: "MEMBER",
    });
  });

  it("rethrows the login redirect for unauthenticated requests", async () => {
    const redirectResponse = new Response(null, {
      status: 302,
      headers: {
        Location: "/login?redirectTo=%2Ffamilies%2Ffamily-1",
      },
    });

    vi.mocked(requireUser).mockRejectedValue(redirectResponse);

    await expect(
      loader({
        params: {
          familyId: "family-1",
        },
        request: buildRequest(),
        context: {} as never,
      } as unknown as Parameters<typeof loader>[0]),
    ).rejects.toBe(redirectResponse);
  });

  it("redirects after an admin removes a member", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(removeFamilyMember).mockResolvedValue({
      status: "REMOVED",
      removedUser: {
        displayName: "Kari",
        id: "user-2",
      },
    });

    const formData = new FormData();
    formData.set("intent", "remove-member");
    formData.set("targetUserId", "user-2");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(removeFamilyMember).toHaveBeenCalledWith({
      actorUserId: "user-1",
      familyId: "family-1",
      targetUserId: "user-2",
    });
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1?notice=member-removed",
    );
  });

  it("returns a form error when the member to remove is missing", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);

    const formData = new FormData();
    formData.set("intent", "remove-member");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(removeFamilyMember).not.toHaveBeenCalled();
    expect(result).toEqual({
      formError: "Fant ikke medlemmet som skulle fjernes.",
    });
  });

  it("returns a specific error when trying to remove another admin", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(removeFamilyMember).mockResolvedValue({
      status: "CANNOT_REMOVE_ADMIN",
    });

    const formData = new FormData();
    formData.set("intent", "remove-member");
    formData.set("targetUserId", "user-2");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toEqual({
      formError: "Bare vanlige medlemmer kan fjernes i denne versjonen.",
      targetUserId: "user-2",
    });
  });

  it("rethrows forbidden admin-only action errors", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(removeFamilyMember).mockRejectedValue(
      new Response("Du har ikke tilgang til a administrere denne familien.", {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    const formData = new FormData();
    formData.set("intent", "remove-member");
    formData.set("targetUserId", "user-2");

    await expect(
      action({
        params: {
          familyId: "family-1",
        },
        request: buildRequest("http://localhost/families/family-1", formData),
        context: {} as never,
      } as unknown as Parameters<typeof action>[0]),
    ).rejects.toMatchObject({
      status: 403,
      statusText: "Forbidden",
    });
  });
});
