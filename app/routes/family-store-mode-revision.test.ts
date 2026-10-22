import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const { mockAuthWithRequireUser } = await import("../test/mock-require-user");

  return mockAuthWithRequireUser();
});

vi.mock("../lib/family.server", () => {
  return {
    requireFamilyMembership: vi.fn(),
  };
});

vi.mock("../lib/store-mode-trip-revision.server", () => {
  return {
    getStoreModeTripRevision: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { requireFamilyMembership } from "../lib/family.server";
import { getStoreModeTripRevision } from "../lib/store-mode-trip-revision.server";
import { loader } from "./family-store-mode-revision";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

describe("family store mode revision route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the trip revision for a member", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: { id: "family-1", name: "Solberg" },
      role: "MEMBER",
      userId: "user-1",
    } as never);
    vi.mocked(getStoreModeTripRevision).mockResolvedValue("rev-1");

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: new Request(
        "http://localhost/families/family-1/store-mode/revision",
      ),
    });

    expect(requireFamilyMembership).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result).toEqual({
      revision: "rev-1",
    });
  });

  it("rejects a non-member", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockRejectedValue(
      new Response("Fant ikke familien.", {
        status: 404,
        statusText: "Not Found",
      }),
    );

    await expect(
      loader({
        params: {
          familyId: "family-1",
        },
        request: new Request(
          "http://localhost/families/family-1/store-mode/revision",
        ),
      }),
    ).rejects.toBeInstanceOf(Response);
    expect(getStoreModeTripRevision).not.toHaveBeenCalled();
  });
});
