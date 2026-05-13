import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, randomIntMock, txMock } = vi.hoisted(() => {
  const tx = {
    family: {
      create: vi.fn(),
    },
    familyMembership: {
      create: vi.fn(),
    },
  };

  const db = {
    family: {
      findUnique: vi.fn(),
    },
    familyMembership: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return {
    dbMock: db,
    randomIntMock: vi.fn(),
    txMock: tx,
  };
});

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<typeof import("node:crypto")>("node:crypto");

  return {
    ...actual,
    randomInt: randomIntMock,
  };
});

vi.mock("./db.server", () => {
  return {
    db: dbMock,
  };
});

import {
  createFamilyForUser,
  getFamilyMembershipForUser,
  joinFamilyByCode,
  listFamilyMembers,
  removeFamilyMember,
  requireFamilyAdmin,
  requireFamilyMembership,
} from "./family.server";

describe("family.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => {
      return callback(txMock);
    });
  });

  it("creates a family, retries join-code collisions, and adds the creator as admin", async () => {
    randomIntMock
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1);

    dbMock.family.findUnique.mockResolvedValueOnce({ id: "family-existing" }).mockResolvedValueOnce(null);
    txMock.family.create.mockResolvedValue({
      id: "family-1",
      joinCode: "BBBBBB",
      name: "Solberg",
    });
    txMock.familyMembership.create.mockResolvedValue({
      familyId: "family-1",
      id: "membership-1",
      role: "ADMIN",
      userId: "user-1",
    });

    const result = await createFamilyForUser({
      name: " Solberg ",
      userId: "user-1",
    });

    expect(dbMock.family.findUnique).toHaveBeenNthCalledWith(1, {
      where: { joinCode: "AAAAAA" },
      select: { id: true },
    });
    expect(dbMock.family.findUnique).toHaveBeenNthCalledWith(2, {
      where: { joinCode: "BBBBBB" },
      select: { id: true },
    });
    expect(txMock.family.create).toHaveBeenCalledWith({
      data: {
        createdByUserId: "user-1",
        joinCode: "BBBBBB",
        name: "Solberg",
      },
      select: {
        id: true,
        joinCode: true,
        name: true,
      },
    });
    expect(txMock.familyMembership.create).toHaveBeenCalledWith({
      data: {
        familyId: "family-1",
        role: "ADMIN",
        userId: "user-1",
      },
    });
    expect(result).toEqual({
      id: "family-1",
      joinCode: "BBBBBB",
      name: "Solberg",
    });
  });

  it("returns NOT_FOUND when the join code does not match a family", async () => {
    dbMock.family.findUnique.mockResolvedValue(null);

    const result = await joinFamilyByCode({
      joinCode: "ABC123",
      userId: "user-1",
    });

    expect(dbMock.family.findUnique).toHaveBeenCalledWith({
      where: { joinCode: "ABC123" },
      select: {
        id: true,
        joinCode: true,
        name: true,
      },
    });
    expect(result).toEqual({
      status: "NOT_FOUND",
    });
    expect(dbMock.familyMembership.findUnique).not.toHaveBeenCalled();
    expect(dbMock.familyMembership.create).not.toHaveBeenCalled();
  });

  it("returns ALREADY_MEMBER without creating a duplicate membership", async () => {
    dbMock.family.findUnique.mockResolvedValue({
      id: "family-1",
      joinCode: "ABC123",
      name: "Solberg",
    });
    dbMock.familyMembership.findUnique.mockResolvedValue({
      id: "membership-1",
    });

    const result = await joinFamilyByCode({
      joinCode: "ABC123",
      userId: "user-1",
    });

    expect(dbMock.familyMembership.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "ALREADY_MEMBER",
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
    });
  });

  it("normalizes join codes before creating a new family membership", async () => {
    dbMock.family.findUnique.mockResolvedValue({
      id: "family-1",
      joinCode: "ABC123",
      name: "Solberg",
    });
    dbMock.familyMembership.findUnique.mockResolvedValue(null);
    dbMock.familyMembership.create.mockResolvedValue({
      familyId: "family-1",
      id: "membership-1",
      role: "MEMBER",
      userId: "user-1",
    });

    const result = await joinFamilyByCode({
      joinCode: " abc123 ",
      userId: "user-1",
    });

    expect(dbMock.family.findUnique).toHaveBeenCalledWith({
      where: { joinCode: "ABC123" },
      select: {
        id: true,
        joinCode: true,
        name: true,
      },
    });
    expect(dbMock.familyMembership.create).toHaveBeenCalledWith({
      data: {
        familyId: "family-1",
        role: "MEMBER",
        userId: "user-1",
      },
    });
    expect(result).toEqual({
      status: "JOINED",
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
    });
  });

  it("looks up a family membership by family and user id", async () => {
    dbMock.familyMembership.findUnique.mockResolvedValue({
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

    const result = await getFamilyMembershipForUser({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(dbMock.familyMembership.findUnique).toHaveBeenCalledWith({
      where: {
        familyId_userId: {
          familyId: "family-1",
          userId: "user-1",
        },
      },
      select: {
        id: true,
        familyId: true,
        role: true,
        userId: true,
        family: {
          select: {
            id: true,
            joinCode: true,
            name: true,
          },
        },
      },
    });
    expect(result).toEqual({
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
  });

  it("throws a not found response when the user is not part of the family", async () => {
    dbMock.familyMembership.findUnique.mockResolvedValue(null);

    await expect(
      requireFamilyMembership({
        familyId: "family-1",
        userId: "user-1",
      }),
    ).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
    });
  });

  it("throws a forbidden response when a family member is not an admin", async () => {
    dbMock.familyMembership.findUnique.mockResolvedValue({
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
      familyId: "family-1",
      id: "membership-1",
      role: "MEMBER",
      userId: "user-1",
    });

    await expect(
      requireFamilyAdmin({
        familyId: "family-1",
        userId: "user-1",
      }),
    ).rejects.toMatchObject({
      status: 403,
      statusText: "Forbidden",
    });
  });

  it("lists family members for the management UI", async () => {
    dbMock.familyMembership.findMany.mockResolvedValue([
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

    const result = await listFamilyMembers("family-1");

    expect(dbMock.familyMembership.findMany).toHaveBeenCalledWith({
      where: { familyId: "family-1" },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        role: true,
        user: {
          select: {
            displayName: true,
            email: true,
            id: true,
          },
        },
      },
    });
    expect(result).toEqual([
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
  });

  it("removes a non-admin family member when requested by an admin", async () => {
    dbMock.familyMembership.findUnique
      .mockResolvedValueOnce({
        family: {
          id: "family-1",
          joinCode: "ABC123",
          name: "Solberg",
        },
        familyId: "family-1",
        id: "membership-admin",
        role: "ADMIN",
        userId: "user-admin",
      })
      .mockResolvedValueOnce({
        id: "membership-member",
        role: "MEMBER",
        user: {
          displayName: "Kari",
          id: "user-member",
        },
      });

    const result = await removeFamilyMember({
      actorUserId: "user-admin",
      familyId: "family-1",
      targetUserId: "user-member",
    });

    expect(dbMock.familyMembership.delete).toHaveBeenCalledWith({
      where: { id: "membership-member" },
    });
    expect(result).toEqual({
      status: "REMOVED",
      removedUser: {
        displayName: "Kari",
        id: "user-member",
      },
    });
  });

  it("refuses to remove another admin", async () => {
    dbMock.familyMembership.findUnique
      .mockResolvedValueOnce({
        family: {
          id: "family-1",
          joinCode: "ABC123",
          name: "Solberg",
        },
        familyId: "family-1",
        id: "membership-admin",
        role: "ADMIN",
        userId: "user-admin",
      })
      .mockResolvedValueOnce({
        id: "membership-target-admin",
        role: "ADMIN",
        user: {
          displayName: "Kari",
          id: "user-target-admin",
        },
      });

    const result = await removeFamilyMember({
      actorUserId: "user-admin",
      familyId: "family-1",
      targetUserId: "user-target-admin",
    });

    expect(dbMock.familyMembership.delete).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "CANNOT_REMOVE_ADMIN",
    });
  });

  it("refuses to remove the acting admin", async () => {
    dbMock.familyMembership.findUnique
      .mockResolvedValueOnce({
        family: {
          id: "family-1",
          joinCode: "ABC123",
          name: "Solberg",
        },
        familyId: "family-1",
        id: "membership-admin",
        role: "ADMIN",
        userId: "user-admin",
      })
      .mockResolvedValueOnce({
        id: "membership-admin",
        role: "ADMIN",
        user: {
          displayName: "Ola",
          id: "user-admin",
        },
      });

    const result = await removeFamilyMember({
      actorUserId: "user-admin",
      familyId: "family-1",
      targetUserId: "user-admin",
    });

    expect(dbMock.familyMembership.delete).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "CANNOT_REMOVE_SELF",
    });
  });

  it("returns NOT_FOUND when the target user is not in the family", async () => {
    dbMock.familyMembership.findUnique
      .mockResolvedValueOnce({
        family: {
          id: "family-1",
          joinCode: "ABC123",
          name: "Solberg",
        },
        familyId: "family-1",
        id: "membership-admin",
        role: "ADMIN",
        userId: "user-admin",
      })
      .mockResolvedValueOnce(null);

    const result = await removeFamilyMember({
      actorUserId: "user-admin",
      familyId: "family-1",
      targetUserId: "user-member",
    });

    expect(dbMock.familyMembership.delete).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "NOT_FOUND",
    });
  });
});
