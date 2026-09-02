import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, randomBytesMock, requireFamilyAdminMock } = vi.hoisted(() => {
  const familyMcpToken = {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const familyMembership = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  };

  return {
    dbMock: {
      $transaction: vi.fn(),
      familyMembership,
      familyMcpToken,
    },
    randomBytesMock: vi.fn(),
    requireFamilyAdminMock: vi.fn(),
  };
});

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  requireFamilyAdmin: requireFamilyAdminMock,
  requireFamilyMembership: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();

  return {
    ...actual,
    randomBytes: randomBytesMock,
  };
});

import {
  buildFamilyMcpUrl,
  buildFamilyMealPlanProposalUrl,
  createOrRotateFamilyMcpToken,
  getFamilyMcpTokenStatus,
  hashFamilyMcpToken,
  resolveFamilyMcpAuth,
  revokeFamilyMcpToken,
} from "./mcp-token.server";

const RAW_TOKEN = "a".repeat(64);
const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

const mockAdmin = {
  family: {
    id: "family-1",
    joinCode: "ABC123",
    name: "Solberg",
  },
  familyId: "family-1",
  id: "membership-1",
  role: "ADMIN",
  userId: "user-1",
};

describe("mcp-token.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T08:00:00.000Z"));
    requireFamilyAdminMock.mockResolvedValue(mockAdmin);
    randomBytesMock.mockReturnValue(Buffer.from(RAW_TOKEN, "hex"));
    dbMock.$transaction.mockImplementation(
      async (callback: (tx: typeof dbMock) => unknown) => callback(dbMock),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hashes MCP tokens with SHA-256", () => {
    expect(hashFamilyMcpToken(RAW_TOKEN)).toBe(TOKEN_HASH);
  });

  it("builds the MCP endpoint URL from an origin", () => {
    expect(buildFamilyMcpUrl("https://mealplanner.example/")).toBe(
      "https://mealplanner.example/mcp",
    );
  });

  it("builds a meal plan proposal URL from origin and ids", () => {
    expect(
      buildFamilyMealPlanProposalUrl({
        familyId: "family-1",
        mealPlanId: "proposal-1",
        origin: "https://mealplanner.example/",
      }),
    ).toBe(
      "https://mealplanner.example/families/family-1/meal-plans/proposal-1/proposal",
    );
  });

  it("stores a hashed token and returns the raw token once", async () => {
    dbMock.familyMcpToken.deleteMany.mockResolvedValue({ count: 0 });
    dbMock.familyMcpToken.create.mockResolvedValue({ id: "mcp-1" });

    const result = await createOrRotateFamilyMcpToken({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(requireFamilyAdminMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result).toEqual({ token: RAW_TOKEN });
    expect(dbMock.familyMcpToken.deleteMany).toHaveBeenCalledWith({
      where: { familyId: "family-1" },
    });
    expect(dbMock.familyMcpToken.create).toHaveBeenCalledWith({
      data: {
        createdByUserId: "user-1",
        familyId: "family-1",
        tokenHash: TOKEN_HASH,
      },
    });
  });

  it("revokes the family MCP token", async () => {
    dbMock.familyMcpToken.deleteMany.mockResolvedValue({ count: 1 });

    await revokeFamilyMcpToken({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(requireFamilyAdminMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(dbMock.familyMcpToken.deleteMany).toHaveBeenCalledWith({
      where: { familyId: "family-1" },
    });
  });

  it("reports whether an MCP token exists", async () => {
    dbMock.familyMcpToken.findUnique.mockResolvedValue({ id: "mcp-1" });

    await expect(
      getFamilyMcpTokenStatus({ familyId: "family-1" }),
    ).resolves.toEqual({ exists: true });

    dbMock.familyMcpToken.findUnique.mockResolvedValue(null);

    await expect(
      getFamilyMcpTokenStatus({ familyId: "family-1" }),
    ).resolves.toEqual({ exists: false });
  });

  it("returns null when the Authorization header is missing or invalid", async () => {
    await expect(resolveFamilyMcpAuth(null)).resolves.toBeNull();
    await expect(resolveFamilyMcpAuth("Basic abc")).resolves.toBeNull();
    expect(dbMock.familyMcpToken.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for an unknown bearer token", async () => {
    dbMock.familyMcpToken.findUnique.mockResolvedValue(null);

    await expect(
      resolveFamilyMcpAuth(`Bearer ${RAW_TOKEN}`),
    ).resolves.toBeNull();
  });

  it("resolves family and creator user, then records lastUsedAt", async () => {
    dbMock.familyMcpToken.findUnique.mockResolvedValue({
      createdByUserId: "user-1",
      familyId: "family-1",
      id: "mcp-1",
    });
    dbMock.familyMembership.findUnique.mockResolvedValue({
      userId: "user-1",
    });
    dbMock.familyMcpToken.update.mockResolvedValue({ id: "mcp-1" });

    await expect(
      resolveFamilyMcpAuth(`Bearer ${RAW_TOKEN}`),
    ).resolves.toEqual({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(dbMock.familyMcpToken.findUnique).toHaveBeenCalledWith({
      select: {
        createdByUserId: true,
        familyId: true,
        id: true,
      },
      where: {
        tokenHash: TOKEN_HASH,
      },
    });
    expect(dbMock.familyMembership.findUnique).toHaveBeenCalledWith({
      select: {
        userId: true,
      },
      where: {
        familyId_userId: {
          familyId: "family-1",
          userId: "user-1",
        },
      },
    });
    expect(dbMock.familyMcpToken.update).toHaveBeenCalledWith({
      data: {
        lastUsedAt: new Date("2026-09-02T08:00:00.000Z"),
      },
      where: {
        id: "mcp-1",
      },
    });
  });

  it("falls back to a remaining family admin when the creator left", async () => {
    dbMock.familyMcpToken.findUnique.mockResolvedValue({
      createdByUserId: "user-gone",
      familyId: "family-1",
      id: "mcp-1",
    });
    dbMock.familyMembership.findUnique.mockResolvedValue(null);
    dbMock.familyMembership.findFirst.mockResolvedValue({
      userId: "admin-2",
    });
    dbMock.familyMcpToken.update.mockResolvedValue({ id: "mcp-1" });

    await expect(
      resolveFamilyMcpAuth(`Bearer ${RAW_TOKEN}`),
    ).resolves.toEqual({
      familyId: "family-1",
      userId: "admin-2",
    });
  });

  it("returns null when no family members remain", async () => {
    dbMock.familyMcpToken.findUnique.mockResolvedValue({
      createdByUserId: null,
      familyId: "family-1",
      id: "mcp-1",
    });
    dbMock.familyMembership.findFirst.mockResolvedValue(null);

    await expect(
      resolveFamilyMcpAuth(`Bearer ${RAW_TOKEN}`),
    ).resolves.toBeNull();
    expect(dbMock.familyMcpToken.update).not.toHaveBeenCalled();
  });
});
