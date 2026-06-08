import { afterEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyAdminMock } = vi.hoisted(() => ({
  dbMock: {
    familyKassalappIntegration: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
  requireFamilyAdminMock: vi.fn(),
}));

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  requireFamilyAdmin: requireFamilyAdminMock,
}));

import {
  removeFamilyKassalappApiToken,
  saveFamilyKassalappApiToken,
} from "./kassalapp-integration-write.server";

describe("kassalapp-integration-write.server", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("validates empty api tokens", async () => {
    const result = await saveFamilyKassalappApiToken({
      apiToken: "   ",
      familyId: "family-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      fieldErrors: {
        apiToken: "Lim inn en Kassalapp API-nøkkel.",
      },
      status: "VALIDATION_ERROR",
    });
    expect(requireFamilyAdminMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
  });

  it("stores encrypted api tokens for admins", async () => {
    dbMock.familyKassalappIntegration.upsert.mockResolvedValue({});

    const result = await saveFamilyKassalappApiToken({
      apiToken: "family-token-12345678",
      familyId: "family-1",
      userId: "user-1",
    });

    expect(result).toEqual({ status: "UPDATED" });
    expect(dbMock.familyKassalappIntegration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          familyId: "family-1",
          tokenLastFour: "5678",
          updatedByUserId: "user-1",
        }),
        update: expect.objectContaining({
          tokenLastFour: "5678",
          updatedByUserId: "user-1",
        }),
        where: {
          familyId: "family-1",
        },
      }),
    );
    expect(
      dbMock.familyKassalappIntegration.upsert.mock.calls[0]?.[0].create
        .encryptedApiToken,
    ).not.toBe("family-token-12345678");
  });

  it("removes stored api tokens", async () => {
    dbMock.familyKassalappIntegration.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      removeFamilyKassalappApiToken({
        familyId: "family-1",
        userId: "user-1",
      }),
    ).resolves.toEqual({ status: "REMOVED" });
  });
});
