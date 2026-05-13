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

import { createFamilyForUser, joinFamilyByCode } from "./family.server";

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
});
