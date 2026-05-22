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

vi.mock("../lib/family.server", () => {
  return {
    getFamilyMembershipsForUser: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { getFamilyMembershipsForUser } from "../lib/family.server";
import { loader } from "./app-layout";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(url: string) {
  return new Request(url);
}

describe("app-layout loader", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns familyId from route params on family routes", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);

    const result = await loader({
      params: { familyId: "family-1" },
      request: buildRequest("http://localhost/families/family-1/stores"),
    } as never);

    expect(result).toEqual({ familyId: "family-1" });
    expect(getFamilyMembershipsForUser).not.toHaveBeenCalled();
  });

  it("returns the only family on /app when the user has one membership", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getFamilyMembershipsForUser).mockResolvedValue([
      {
        id: "membership-1",
        role: "ADMIN",
        family: { id: "family-1", name: "Solberg" },
      },
    ] as never);

    const result = await loader({
      params: {},
      request: buildRequest("http://localhost/app"),
    } as never);

    expect(result).toEqual({ familyId: "family-1" });
  });

  it("returns null familyId on /app when the user has multiple memberships", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getFamilyMembershipsForUser).mockResolvedValue([
      {
        id: "membership-1",
        role: "ADMIN",
        family: { id: "family-1", name: "Solberg" },
      },
      {
        id: "membership-2",
        role: "MEMBER",
        family: { id: "family-2", name: "Nordvik" },
      },
    ] as never);

    const result = await loader({
      params: {},
      request: buildRequest("http://localhost/app"),
    } as never);

    expect(result).toEqual({ familyId: null });
  });
});
