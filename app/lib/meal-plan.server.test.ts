import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyAdminMock, requireFamilyMembershipMock } = vi.hoisted(() => {
  return {
    dbMock: {
      $transaction: vi.fn(),
      mealPlan: {
        create: vi.fn(),
        delete: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      mealPlanEntry: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      recipe: {
        findMany: vi.fn(),
      },
    },
    requireFamilyAdminMock: vi.fn(),
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
    requireFamilyAdmin: requireFamilyAdminMock,
    requireFamilyMembership: requireFamilyMembershipMock,
  };
});

vi.mock("./write-observability.server", () => {
  return {
    logCollaborationFailure: vi.fn(),
    logCollaborationWrite: vi.fn(),
  };
});

import {
  approveMealPlan,
  autoFillMealPlanEntries,
  copyMealPlan,
  createMealPlan,
  deleteMealPlan,
  formatDateOnly,
  getMealPlanForFamily,
  getMealPlanPlanningData,
  getRecentlyUsedRecipeIds,
  listMealPlansForFamily,
  reopenMealPlan,
  saveMealPlanEntries,
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
    requireFamilyAdminMock.mockResolvedValue(mockMembership);
    requireFamilyMembershipMock.mockResolvedValue(mockMembership);
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<unknown>) =>
      callback(dbMock),
    );
    dbMock.mealPlanEntry.findMany.mockResolvedValue([]);
    dbMock.mealPlan.updateMany.mockResolvedValue({ count: 1 });
    dbMock.mealPlan.findUniqueOrThrow.mockResolvedValue({
      id: "meal-plan-1",
      title: "Langhelg",
    });
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
        activeShoppingDate: true,
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

  it("copies dinner entries into a new target range using relative offsets", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      entries: [
        {
          date: new Date("2026-05-15T00:00:00.000Z"),
          note: "Rester til lunsj",
          recipeId: "kylling-taco",
        },
        {
          date: new Date("2026-05-17T00:00:00.000Z"),
          note: null,
          recipeId: "tomatsuppe",
        },
      ],
      id: "meal-plan-source",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });
    dbMock.mealPlan.create.mockResolvedValue({
      approvedAt: null,
      approvedByUserId: null,
      copiedFromMealPlanId: "meal-plan-source",
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-22T00:00:00.000Z"),
      id: "meal-plan-copy",
      startDate: new Date("2026-05-20T00:00:00.000Z"),
      status: "DRAFT",
      title: "Neste uke",
      updatedAt: new Date("2026-05-01T12:00:00.000Z"),
    });

    const result = await copyMealPlan({
      endDate: "2026-05-22",
      familyId: "family-1",
      sourceMealPlanId: "meal-plan-source",
      startDate: "2026-05-20",
      title: "Neste uke",
      userId: "user-1",
    });

    expect(result.status).toBe("CREATED");
    expect(dbMock.mealPlan.findFirst).toHaveBeenCalledWith({
      select: {
        entries: {
          orderBy: [{ date: "asc" }],
          select: {
            date: true,
            note: true,
            recipeId: true,
          },
          where: {
            mealType: "DINNER",
          },
        },
        id: true,
        startDate: true,
      },
      where: {
        familyId: "family-1",
        id: "meal-plan-source",
      },
    });
    expect(dbMock.mealPlan.create).toHaveBeenCalledWith({
      data: {
        activeShoppingDate: new Date("2026-05-20T00:00:00.000Z"),
        copiedFromMealPlanId: "meal-plan-source",
        endDate: new Date("2026-05-22T00:00:00.000Z"),
        familyId: "family-1",
        startDate: new Date("2026-05-20T00:00:00.000Z"),
        title: "Neste uke",
      },
      select: {
        activeShoppingDate: true,
        approvedAt: true,
        approvedByUserId: true,
        copiedFromMealPlanId: true,
        createdAt: true,
        endDate: true,
        id: true,
        startDate: true,
        status: true,
        title: true,
        updatedAt: true,
      },
    });
    expect(dbMock.mealPlanEntry.createMany).toHaveBeenCalledWith({
      data: [
        {
          date: new Date("2026-05-20T00:00:00.000Z"),
          mealPlanId: "meal-plan-copy",
          mealType: "DINNER",
          note: "Rester til lunsj",
          recipeId: "kylling-taco",
        },
        {
          date: new Date("2026-05-22T00:00:00.000Z"),
          mealPlanId: "meal-plan-copy",
          mealType: "DINNER",
          note: null,
          recipeId: "tomatsuppe",
        },
      ],
    });
  });

  it("truncates copied entries that fall outside a shorter target range", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      entries: [
        {
          date: new Date("2026-05-15T00:00:00.000Z"),
          note: "",
          recipeId: "kylling-taco",
        },
        {
          date: new Date("2026-05-16T00:00:00.000Z"),
          note: "Bare notat",
          recipeId: null,
        },
        {
          date: new Date("2026-05-17T00:00:00.000Z"),
          note: "",
          recipeId: "tomatsuppe",
        },
      ],
      id: "meal-plan-source",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });
    dbMock.mealPlan.create.mockResolvedValue({
      approvedAt: null,
      approvedByUserId: null,
      copiedFromMealPlanId: "meal-plan-source",
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-21T00:00:00.000Z"),
      id: "meal-plan-copy",
      startDate: new Date("2026-05-20T00:00:00.000Z"),
      status: "DRAFT",
      title: "Kort uke",
      updatedAt: new Date("2026-05-01T12:00:00.000Z"),
    });

    await copyMealPlan({
      endDate: "2026-05-21",
      familyId: "family-1",
      sourceMealPlanId: "meal-plan-source",
      startDate: "2026-05-20",
      title: "Kort uke",
      userId: "user-1",
    });

    expect(dbMock.mealPlanEntry.createMany).toHaveBeenCalledWith({
      data: [
        {
          date: new Date("2026-05-20T00:00:00.000Z"),
          mealPlanId: "meal-plan-copy",
          mealType: "DINNER",
          note: "",
          recipeId: "kylling-taco",
        },
        {
          date: new Date("2026-05-21T00:00:00.000Z"),
          mealPlanId: "meal-plan-copy",
          mealType: "DINNER",
          note: "Bare notat",
          recipeId: null,
        },
      ],
    });
  });

  it("returns NOT_FOUND when the source meal plan is outside the family scope", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue(null);

    const result = await copyMealPlan({
      endDate: "2026-05-22",
      familyId: "family-1",
      sourceMealPlanId: "meal-plan-404",
      startDate: "2026-05-20",
      title: "Neste uke",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "NOT_FOUND",
    });
    expect(dbMock.mealPlan.create).not.toHaveBeenCalled();
    expect(dbMock.mealPlanEntry.createMany).not.toHaveBeenCalled();
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

  it("loads planning data with visible dates and available recipes", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      approvedAt: null,
      approvedByUserId: null,
      copiedFromMealPlanId: null,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      entries: [
        {
          createdAt: new Date("2026-05-01T12:00:00.000Z"),
          date: new Date("2026-05-15T00:00:00.000Z"),
          id: "entry-1",
          locked: false,
          mealType: "DINNER",
          note: "Bruk rester",
          recipe: null,
          recipeId: null,
          updatedAt: new Date("2026-05-01T12:00:00.000Z"),
        },
      ],
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Langhelg",
      updatedAt: new Date("2026-05-01T12:00:00.000Z"),
    });
    dbMock.recipe.findMany.mockResolvedValue([
      {
        defaultServings: 4,
        description: "Rask middagsfavoritt.",
        id: "kylling-taco",
        prepMinutes: 25,
        tags: ["rask"],
        title: "Kyllingtaco",
      },
    ]);

    const result = await getMealPlanPlanningData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.visibleDates).toEqual(["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"]);
    expect(result.recipes).toEqual([
      {
        defaultServings: 4,
        description: "Rask middagsfavoritt.",
        id: "kylling-taco",
        prepMinutes: 25,
        tags: ["rask"],
        title: "Kyllingtaco",
      },
    ]);
    expect(dbMock.recipe.findMany).toHaveBeenCalledWith({
      orderBy: [{ title: "asc" }],
      select: {
        defaultServings: true,
        description: true,
        id: true,
        prepMinutes: true,
        tags: true,
        title: true,
      },
      where: {
        OR: [{ scope: "GLOBAL" }, { familyId: "family-1", scope: "FAMILY" }],
      },
    });
  });

  it("returns NOT_FOUND when updating a missing meal plan", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue(null);

    const result = await updateMealPlan({
      endDate: "2026-05-18",
      expectedMealPlanUpdatedAt: "",
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

  it("approves a draft meal plan as a family member", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      entries: [],
      id: "meal-plan-1",
      status: "DRAFT",
      updatedAt: new Date("2026-05-16T09:00:00.000Z"),
    });
    dbMock.mealPlan.update.mockResolvedValue({
      approvedAt: new Date("2026-05-16T09:30:00.000Z"),
      approvedByUserId: "user-1",
      copiedFromMealPlanId: null,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "APPROVED",
      title: "Langhelg",
      updatedAt: new Date("2026-05-16T09:30:00.000Z"),
    });

    const result = await approveMealPlan({
      entriesSnapshot: "",
      expectedMealPlanUpdatedAt: new Date("2026-05-16T09:00:00.000Z").toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(requireFamilyMembershipMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(dbMock.mealPlan.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        approvedAt: expect.any(Date),
        approvedByUserId: "user-1",
        status: "APPROVED",
        updatedByUserId: "user-1",
      }),
      select: {
        activeShoppingDate: true,
        approvedAt: true,
        approvedByUserId: true,
        copiedFromMealPlanId: true,
        createdAt: true,
        endDate: true,
        id: true,
        startDate: true,
        status: true,
        title: true,
        updatedAt: true,
      },
      where: {
        id: "meal-plan-1",
      },
    });
    expect(result.status).toBe("APPROVED");
  });

  it("reopens an approved meal plan back to draft", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      entries: [],
      id: "meal-plan-1",
      status: "APPROVED",
      updatedAt: new Date("2026-05-16T09:30:00.000Z"),
    });
    dbMock.mealPlan.update.mockResolvedValue({
      approvedAt: null,
      approvedByUserId: null,
      copiedFromMealPlanId: null,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Langhelg",
      updatedAt: new Date("2026-05-16T09:35:00.000Z"),
    });

    const result = await reopenMealPlan({
      entriesSnapshot: "",
      expectedMealPlanUpdatedAt: "",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(requireFamilyMembershipMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(dbMock.mealPlan.update).toHaveBeenCalledWith({
      data: {
        approvedAt: null,
        approvedByUserId: null,
        status: "DRAFT",
        updatedByUserId: "user-1",
      },
      select: {
        activeShoppingDate: true,
        approvedAt: true,
        approvedByUserId: true,
        copiedFromMealPlanId: true,
        createdAt: true,
        endDate: true,
        id: true,
        startDate: true,
        status: true,
        title: true,
        updatedAt: true,
      },
      where: {
        id: "meal-plan-1",
      },
    });
    expect(result.status).toBe("REOPENED");
  });

  it("returns an invalid-transition error when approving an already approved meal plan", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      entries: [],
      id: "meal-plan-1",
      status: "APPROVED",
      updatedAt: new Date("2026-05-16T09:30:00.000Z"),
    });

    const result = await approveMealPlan({
      entriesSnapshot: "",
      expectedMealPlanUpdatedAt: new Date("2026-05-16T09:00:00.000Z").toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      formError: "Ukeplanen er allerede godkjent.",
      status: "INVALID_TRANSITION",
    });
    expect(dbMock.mealPlan.update).not.toHaveBeenCalled();
  });

  it("approves a draft meal plan as a non-admin family member", async () => {
    requireFamilyMembershipMock.mockResolvedValue({
      ...mockMembership,
      role: "MEMBER",
      userId: "user-2",
    });
    dbMock.mealPlan.findFirst.mockResolvedValue({
      entries: [],
      id: "meal-plan-1",
      status: "DRAFT",
      updatedAt: new Date("2026-05-16T09:00:00.000Z"),
    });
    dbMock.mealPlan.update.mockResolvedValue({
      approvedAt: new Date("2026-05-16T09:30:00.000Z"),
      approvedByUserId: "user-2",
      copiedFromMealPlanId: null,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "APPROVED",
      title: "Langhelg",
      updatedAt: new Date("2026-05-16T09:30:00.000Z"),
    });

    const result = await approveMealPlan({
      entriesSnapshot: "",
      expectedMealPlanUpdatedAt: new Date("2026-05-16T09:00:00.000Z").toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-2",
    });

    expect(requireFamilyMembershipMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-2",
    });
    expect(result.status).toBe("APPROVED");
  });

  it("rethrows the membership authorization failure for approval changes", async () => {
    requireFamilyMembershipMock.mockRejectedValue(
      new Response("Forbidden", {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    await expect(
      approveMealPlan({
        entriesSnapshot: "",
        expectedMealPlanUpdatedAt: "",
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
        userId: "user-2",
      }),
    ).rejects.toMatchObject({
      status: 403,
      statusText: "Forbidden",
    });
    expect(dbMock.mealPlan.findFirst).not.toHaveBeenCalled();
  });

  it("rejects entry submissions that do not cover the full visible range", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });

    const result = await saveMealPlanEntries({
      entries: [
        {
          date: "2026-05-15",
          note: "",
          recipeId: "kylling-taco",
        },
      ],
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      entryVersions: {},
      userId: "user-1",
    });

    expect(result).toEqual({
      formError: "Noen dager mangler i ukeplanen. Last siden på nytt og prøv igjen.",
      status: "VALIDATION_ERROR",
      values: [
        {
          date: "2026-05-15",
          note: "",
          recipeId: "kylling-taco",
        },
      ],
    });
    expect(dbMock.mealPlanEntry.upsert).not.toHaveBeenCalled();
  });

  it("upserts dinner entries and clears empty dates", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-16T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });
    dbMock.recipe.findMany.mockResolvedValue([{ id: "kylling-taco" }]);

    const result = await saveMealPlanEntries({
      entries: [
        {
          date: "2026-05-15",
          note: "",
          recipeId: "kylling-taco",
        },
        {
          date: "2026-05-16",
          note: "",
          recipeId: "",
        },
      ],
      entryVersions: {},
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(dbMock.mealPlanEntry.upsert).toHaveBeenCalledTimes(1);
    expect(dbMock.mealPlanEntry.deleteMany).toHaveBeenCalledWith({
      where: {
        date: new Date("2026-05-16T00:00:00.000Z"),
        mealPlanId: "meal-plan-1",
        mealType: "DINNER",
      },
    });
  });

  it("supports note-only entries while keeping recipe optional", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-15T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });

    const result = await saveMealPlanEntries({
      entries: [
        {
          date: "2026-05-15",
          note: "Bruk rester til lunsj",
          recipeId: "",
        },
      ],
      entryVersions: {},
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(dbMock.mealPlanEntry.upsert).toHaveBeenCalledWith({
      create: {
        date: new Date("2026-05-15T00:00:00.000Z"),
        mealPlanId: "meal-plan-1",
        mealType: "DINNER",
        note: "Bruk rester til lunsj",
        recipeId: null,
        updatedByUserId: "user-1",
      },
      update: {
        note: "Bruk rester til lunsj",
        recipeId: null,
        updatedByUserId: "user-1",
      },
      where: {
        mealPlanId_date_mealType: {
          date: new Date("2026-05-15T00:00:00.000Z"),
          mealPlanId: "meal-plan-1",
          mealType: "DINNER",
        },
      },
    });
  });

  it("returns CONFLICT when an entry version is stale", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-15T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });
    dbMock.mealPlanEntry.findMany.mockResolvedValue([
      {
        date: new Date("2026-05-15T00:00:00.000Z"),
        updatedAt: new Date("2026-05-16T10:00:00.000Z"),
      },
    ]);

    const result = await saveMealPlanEntries({
      entries: [
        {
          date: "2026-05-15",
          note: "Oppdatert notat",
          recipeId: "",
        },
      ],
      entryVersions: {
        "2026-05-15": "2026-05-15T09:00:00.000Z",
      },
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      conflictingDates: ["2026-05-15"],
      formError: expect.stringContaining("Noen andre har oppdatert"),
      status: "CONFLICT",
      values: [
        {
          date: "2026-05-15",
          note: "Oppdatert notat",
          recipeId: "",
        },
      ],
    });
    expect(dbMock.mealPlanEntry.upsert).not.toHaveBeenCalled();
  });

  it("rejects inaccessible recipe selections before writing entries", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-15T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });
    dbMock.recipe.findMany.mockResolvedValue([]);

    const result = await saveMealPlanEntries({
      entries: [
        {
          date: "2026-05-15",
          note: "",
          recipeId: "ukjent-rett",
        },
      ],
      entryVersions: {},
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      formError: "Minst en valgt oppskrift er ikke tilgjengelig for familien.",
      status: "VALIDATION_ERROR",
      values: [
        {
          date: "2026-05-15",
          note: "",
          recipeId: "ukjent-rett",
        },
      ],
    });
    expect(dbMock.mealPlanEntry.upsert).not.toHaveBeenCalled();
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

  it("collects recipe ids from the two most recent other meal plans", async () => {
    dbMock.mealPlan.findMany.mockResolvedValue([
      {
        entries: [{ recipeId: "recipe-a" }, { recipeId: "recipe-b" }],
      },
      {
        entries: [{ recipeId: "recipe-c" }],
      },
    ]);

    const result = await getRecentlyUsedRecipeIds({
      currentMealPlanId: "meal-plan-3",
      familyId: "family-1",
    });

    expect(result).toEqual(new Set(["recipe-a", "recipe-b", "recipe-c"]));
    expect(dbMock.mealPlan.findMany).toHaveBeenCalledWith({
      orderBy: {
        endDate: "desc",
      },
      select: {
        entries: {
          select: {
            recipeId: true,
          },
          where: {
            mealType: "DINNER",
            recipeId: {
              not: null,
            },
          },
        },
      },
      take: 2,
      where: {
        familyId: "family-1",
        id: {
          not: "meal-plan-3",
        },
      },
    });
  });

  it("rejects auto-fill for approved meal plans", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      approvedAt: new Date("2026-05-16T09:30:00.000Z"),
      approvedByUserId: "user-1",
      copiedFromMealPlanId: null,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      entries: [],
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "APPROVED",
      title: "Langhelg",
      updatedAt: new Date("2026-05-16T09:30:00.000Z"),
    });

    const result = await autoFillMealPlanEntries({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      formError: "Godkjente ukeplaner kan ikke fylles automatisk.",
      status: "NOT_DRAFT",
    });
    expect(dbMock.recipe.findMany).not.toHaveBeenCalled();
  });

  it("returns NOTHING_TO_FILL when all days already have content", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      approvedAt: null,
      approvedByUserId: null,
      copiedFromMealPlanId: null,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-16T00:00:00.000Z"),
      entries: [
        {
          createdAt: new Date("2026-05-01T12:00:00.000Z"),
          date: new Date("2026-05-15T00:00:00.000Z"),
          id: "entry-1",
          locked: false,
          mealType: "DINNER",
          note: "",
          recipe: null,
          recipeId: "kylling-taco",
          updatedAt: new Date("2026-05-01T12:00:00.000Z"),
        },
        {
          createdAt: new Date("2026-05-01T12:00:00.000Z"),
          date: new Date("2026-05-16T00:00:00.000Z"),
          id: "entry-2",
          locked: false,
          mealType: "DINNER",
          note: "Bruk rester",
          recipe: null,
          recipeId: null,
          updatedAt: new Date("2026-05-01T12:00:00.000Z"),
        },
      ],
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Langhelg",
      updatedAt: new Date("2026-05-01T12:00:00.000Z"),
    });

    const result = await autoFillMealPlanEntries({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      filledCount: 0,
      status: "NOTHING_TO_FILL",
    });
    expect(dbMock.mealPlanEntry.upsert).not.toHaveBeenCalled();
  });

  it("rejects auto-fill when every recipe was used in recent meal plans", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      approvedAt: null,
      approvedByUserId: null,
      copiedFromMealPlanId: null,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-16T00:00:00.000Z"),
      entries: [],
      id: "meal-plan-3",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 22",
      updatedAt: new Date("2026-05-01T12:00:00.000Z"),
    });
    dbMock.mealPlan.findMany.mockResolvedValue([
      {
        entries: [{ recipeId: "kylling-taco" }],
      },
    ]);
    dbMock.recipe.findMany.mockResolvedValue([{ id: "kylling-taco" }]);

    const result = await autoFillMealPlanEntries({
      familyId: "family-1",
      mealPlanId: "meal-plan-3",
      userId: "user-1",
    });

    expect(result).toEqual({
      formError:
        "Ingen tilgjengelige oppskrifter etter a ha utelatt middager fra de to forrige ukeplanene.",
      status: "NO_ELIGIBLE_RECIPES",
    });
    expect(dbMock.mealPlanEntry.upsert).not.toHaveBeenCalled();
  });

  it("auto-fills only empty days while excluding recent recipes", async () => {
    const planningMealPlan = {
      approvedAt: null,
      approvedByUserId: null,
      copiedFromMealPlanId: null,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-24T00:00:00.000Z"),
      entries: [
        {
          createdAt: new Date("2026-05-01T12:00:00.000Z"),
          date: new Date("2026-05-22T00:00:00.000Z"),
          id: "entry-1",
          locked: false,
          mealType: "DINNER",
          note: "",
          recipe: null,
          recipeId: "recipe-d",
          updatedAt: new Date("2026-05-01T12:00:00.000Z"),
        },
      ],
      id: "meal-plan-3",
      startDate: new Date("2026-05-22T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 22",
      updatedAt: new Date("2026-05-01T12:00:00.000Z"),
    };

    dbMock.mealPlan.findFirst
      .mockResolvedValueOnce(planningMealPlan)
      .mockResolvedValueOnce({
        endDate: planningMealPlan.endDate,
        id: planningMealPlan.id,
        startDate: planningMealPlan.startDate,
      });
    dbMock.mealPlan.findMany.mockResolvedValue([
      {
        entries: [{ recipeId: "recipe-a" }],
      },
    ]);
    dbMock.recipe.findMany
      .mockResolvedValueOnce([
        { id: "recipe-a" },
        { id: "recipe-b" },
        { id: "recipe-c" },
      ])
      .mockResolvedValueOnce([{ id: "recipe-b" }, { id: "recipe-c" }, { id: "recipe-d" }]);
    dbMock.mealPlanEntry.findMany.mockResolvedValue([
      {
        date: new Date("2026-05-22T00:00:00.000Z"),
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
      },
    ]);

    const result = await autoFillMealPlanEntries({
      familyId: "family-1",
      mealPlanId: "meal-plan-3",
      userId: "user-1",
    });

    expect(result.status).toBe("AUTO_FILLED");
    expect(result).toMatchObject({
      excludedCount: 1,
      filledCount: 2,
    });
    expect(dbMock.mealPlanEntry.upsert).toHaveBeenCalledTimes(3);
    expect(dbMock.mealPlanEntry.deleteMany).not.toHaveBeenCalled();

    const upsertedRecipeIds = dbMock.mealPlanEntry.upsert.mock.calls.map(
      (call) => call[0].create.recipeId,
    );

    expect(upsertedRecipeIds).toContain("recipe-d");
    expect(upsertedRecipeIds).not.toContain("recipe-a");
    expect(new Set(upsertedRecipeIds).size).toBe(3);
  });

  it("warns when repeats are required because the eligible pool is too small", async () => {
    const planningMealPlan = {
      approvedAt: null,
      approvedByUserId: null,
      copiedFromMealPlanId: null,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-24T00:00:00.000Z"),
      entries: [],
      id: "meal-plan-3",
      startDate: new Date("2026-05-22T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 22",
      updatedAt: new Date("2026-05-01T12:00:00.000Z"),
    };

    dbMock.mealPlan.findFirst
      .mockResolvedValueOnce(planningMealPlan)
      .mockResolvedValueOnce({
        endDate: planningMealPlan.endDate,
        id: planningMealPlan.id,
        startDate: planningMealPlan.startDate,
      });
    dbMock.mealPlan.findMany.mockResolvedValue([]);
    dbMock.recipe.findMany
      .mockResolvedValueOnce([{ id: "recipe-b" }])
      .mockResolvedValueOnce([{ id: "recipe-b" }]);

    const result = await autoFillMealPlanEntries({
      familyId: "family-1",
      mealPlanId: "meal-plan-3",
      userId: "user-1",
    });

    expect(result).toEqual({
      excludedCount: 0,
      filledCount: 3,
      status: "AUTO_FILLED",
      warning:
        "Noen middager ble valgt flere ganger fordi det var for fa oppskrifter igjen.",
    });
  });
});
