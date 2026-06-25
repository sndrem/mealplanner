import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock } = vi.hoisted(() => {
  return {
    dbMock: {
      familyFreezerItem: {
        create: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
    },
    requireFamilyMembershipMock: vi.fn(),
  };
});

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  requireFamilyMembership: requireFamilyMembershipMock,
}));

import {
  addFamilyFreezerItem,
  removeFamilyFreezerItem,
  updateFamilyFreezerItem,
} from "./freezer-write.server";

describe("freezer-write.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyMembershipMock.mockResolvedValue({
      family: { id: "family-1", name: "Testfamilie" },
      role: "MEMBER",
      userId: "user-1",
    });
  });

  it("rejects empty freezer item input", async () => {
    const result = await addFamilyFreezerItem({
      familyId: "family-1",
      userId: "user-1",
      values: {
        label: "   ",
        note: "",
        quantity: "2",
      },
    });

    expect(result.status).toBe("VALIDATION_ERROR");
    if (result.status === "VALIDATION_ERROR") {
      expect(result.fieldErrors?.label).toBeTruthy();
    }
  });

  it("creates a freezer item", async () => {
    dbMock.familyFreezerItem.create.mockResolvedValue({ id: "freezer-1" });

    const result = await addFamilyFreezerItem({
      familyId: "family-1",
      userId: "user-1",
      values: {
        label: "Chili",
        note: "Boks 2",
        quantity: "4",
      },
    });

    expect(result).toEqual({
      freezerItemId: "freezer-1",
      status: "CREATED",
    });
    expect(dbMock.familyFreezerItem.create).toHaveBeenCalledWith({
      data: {
        familyId: "family-1",
        label: "Chili",
        note: "Boks 2",
        quantity: 4,
      },
      select: {
        id: true,
      },
    });
  });

  it("updates a freezer item", async () => {
    dbMock.familyFreezerItem.updateMany.mockResolvedValue({ count: 1 });

    const result = await updateFamilyFreezerItem({
      familyId: "family-1",
      freezerItemId: "freezer-1",
      userId: "user-1",
      values: {
        label: "Chili oppdatert",
        note: "",
        quantity: "3",
      },
    });

    expect(result.status).toBe("UPDATED");
    expect(dbMock.familyFreezerItem.updateMany).toHaveBeenCalledWith({
      data: {
        label: "Chili oppdatert",
        note: null,
        quantity: 3,
      },
      where: {
        familyId: "family-1",
        id: "freezer-1",
      },
    });
  });

  it("removes a freezer item", async () => {
    dbMock.familyFreezerItem.deleteMany.mockResolvedValue({ count: 1 });

    const result = await removeFamilyFreezerItem({
      familyId: "family-1",
      freezerItemId: "freezer-1",
      userId: "user-1",
    });

    expect(result.status).toBe("DELETED");
  });
});
