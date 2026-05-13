import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock } = vi.hoisted(() => {
  return {
    dbMock: {
      mealPlan: {
        create: vi.fn(),
        delete: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    },
    requireFamilyMembershipMock: vi.fn(),
  };
});

vi.mock("./db.server", () => {
  return {
    db: dbMock,
  };
});

vi.mock("./family.server", () => {
  return {
    requireFamilyMembership: requireFamilyMembershipMock,
  };
});

import {
  createMealPlan,
  deleteMealPlan,
  formatDateOnly,
  getMealPlanForFamily,
  listMealPlansForFamily,
  updateMealPlan,
  validateMealPlanRange,
} from "./meal-plan.server";

const mockMembership = {
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

describe("meal-plan.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyMembershipMock.mockResolvedValue(mockMembership);
  });

  it("rejects missing date fields", () => {
    expect(validateMealPlanRange("", "")).toEqual({
      fieldErrors: {
        endDate: "Velg en sluttdato.",
        startDate: "Velg en startdato.",
      },
      ok: false,
      values: {
        endDate: "",
        startDate: "",
        title: "",
      },
    });
  });

  it("rejects reversed date ranges", () => {
    expect(validateMealPlanRange("2026-05-18", "2026-05-15")).toEqual({
      fieldErrors: {
        endDate: "Sluttdatoen kan ikke være før startdatoen.",
      },
      ok: false,
      values: {
        endDate: "2026-05-15",
        startDate: "2026-05-18",
        title: "",
      },
    });
  });

  it("rejects ranges longer than seven days", () => {
    expect(validateMealPlanRange("2026-05-12", "2026-05-20")).toEqual({
      fieldErrors: {
        endDate: "Datointervallet kan være maks 7 dager.",
      },
      ok: false,
      values: {
        endDate: "2026-05-20",
        startDate: "2026-05-12",
        title: "",
      },
    });
  });

  it("accepts valid partial-week ranges", () => {
    expect(validateMealPlanRange("2026-05-14", "2026-05-17")).toEqual({
      ok: true,
      values: {
        endDate: "2026-05-17",
        startDate: "2026-05-14",
        title: "",
      },
    });
  });

  it("lists meal plans only after verifying family membership", async () => {
    dbMock.mealPlan.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-05-01T12:00:00.000Z"),
        endDate: new Date("2026-05-18T00:00:00.000Z"),
        id: "meal-plan-1",
        startDate: new Date("2026-05-12T00:00:00.000Z"),
        status: "DRAFT",
        title: "Uke 20",
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
      },
    ]);

    const result = await listMealPlansForFamily({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(requireFamilyMembershipMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(dbMock.mealPlan.findMany).toHaveBeenCalledWith({
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: {
        createdAt: true,
        endDate: true,
        id: true,
        startDate: true,
        status: true,
        title: true,
        updatedAt: true,
      },
      where: {
        familyId: "family-1",
      },
    });
    expect(result.family).toEqual({
      id: "family-1",
      name: "Solberg",
    });
    expect(result.userRole).toBe("ADMIN");
  });

  it("creates a meal plan with trimmed title and UTC date-only values", async () => {
    dbMock.mealPlan.create.mockResolvedValue({
      approvedAt: null,
      approvedByUserId: null,
      copiedFromMealPlanId: null,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Langhelg",
      updatedAt: new Date("2026-05-01T12:00:00.000Z"),
    });

    const result = await createMealPlan({
      endDate: "2026-05-18",
      familyId: "family-1",
      startDate: "2026-05-15",
      title: " Langhelg ",
      userId: "user-1",
    });

    expect(result.status).toBe("CREATED");
    expect(dbMock.mealPlan.create).toHaveBeenCalledTimes(1);

    const createCall = dbMock.mealPlan.create.mock.calls[0][0];
    expect(createCall.data.familyId).toBe("family-1");
    expect(createCall.data.title).toBe("Langhelg");
    expect(formatDateOnly(createCall.data.startDate)).toBe("2026-05-15");
    expect(formatDateOnly(createCall.data.endDate)).toBe("2026-05-18");
  });

  it("returns validation errors instead of creating invalid meal plans", async () => {
    const result = await createMealPlan({
      endDate: "2026-05-20",
      familyId: "family-1",
      startDate: "2026-05-12",
      title: " ",
      userId: "user-1",
    });

    expect(result).toEqual({
      fieldErrors: {
        endDate: "Datointervallet kan være maks 7 dager.",
        title: "Skriv inn et navn for ukeplanen.",
      },
      status: "VALIDATION_ERROR",
      values: {
        endDate: "2026-05-20",
        startDate: "2026-05-12",
        title: "",
      },
    });
    expect(dbMock.mealPlan.create).not.toHaveBeenCalled();
  });

  it("throws a not-found response when a meal plan is outside the family scope", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue(null);

    await expect(
      getMealPlanForFamily({
        familyId: "family-1",
        mealPlanId: "meal-plan-404",
        userId: "user-1",
      }),
    ).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
    });
  });

  it("returns NOT_FOUND when updating a missing meal plan", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue(null);

    const result = await updateMealPlan({
      endDate: "2026-05-18",
      familyId: "family-1",
      mealPlanId: "meal-plan-404",
      startDate: "2026-05-15",
      title: "Langhelg",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "NOT_FOUND",
    });
    expect(dbMock.mealPlan.update).not.toHaveBeenCalled();
  });

  it("deletes meal plans only within the scoped family", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      id: "meal-plan-1",
      title: "Uke 20",
    });
    dbMock.mealPlan.delete.mockResolvedValue({
      id: "meal-plan-1",
    });

    const result = await deleteMealPlan({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(dbMock.mealPlan.findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
        title: true,
      },
      where: {
        familyId: "family-1",
        id: "meal-plan-1",
      },
    });
    expect(dbMock.mealPlan.delete).toHaveBeenCalledWith({
      where: {
        id: "meal-plan-1",
      },
    });
    expect(result).toEqual({
      deletedMealPlan: {
        id: "meal-plan-1",
        title: "Uke 20",
      },
      status: "DELETED",
    });
  });
});
