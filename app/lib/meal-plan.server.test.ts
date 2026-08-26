import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  listFamilyMembersMock,
  requireFamilyAdminMock,
  requireFamilyMembershipMock,
} = vi.hoisted(() => {
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
      mealPlanShare: {
        updateMany: vi.fn(),
      },
      mealPlanEntry: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      manualShoppingItem: {
        updateMany: vi.fn(),
      },
      shoppingItemOverride: {
        updateMany: vi.fn(),
      },
      familyFreezerItem: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      recipe: {
        findMany: vi.fn(),
      },
    },
    listFamilyMembersMock: vi.fn(),
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
    listFamilyMembers: listFamilyMembersMock,
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

vi.mock("./freezer.server", () => {
  return {
    listActiveFreezerItemsForPlanning: vi.fn().mockResolvedValue([]),
  };
});

import {
  approveMealPlan,
  autoFillMealPlanEntries,
  copyMealPlan,
  createMealPlan,
  deleteMealPlan,
  getDinnerAnalyticsForFamily,
  formatDateOnly,
  getMealPlanForFamily,
  getMealPlanMaxSpanMessage,
  getMealPlanPlanningData,
  getRecentlyUsedRecipeIds,
  listMealPlansForFamily,
  MEAL_PLAN_MAX_SPAN_DAYS,
  reopenMealPlan,
  saveMealPlanEntries,
  updateMealPlan,
  unionMealPlanDateRanges,
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
    dbMock.familyFreezerItem.findMany.mockResolvedValue([]);
    dbMock.familyFreezerItem.updateMany.mockResolvedValue({ count: 1 });
    dbMock.mealPlan.updateMany.mockResolvedValue({ count: 1 });
    dbMock.mealPlanShare.updateMany.mockResolvedValue({ count: 0 });
    dbMock.manualShoppingItem.updateMany.mockResolvedValue({ count: 0 });
    dbMock.shoppingItemOverride.updateMany.mockResolvedValue({ count: 0 });
    dbMock.mealPlanEntry.deleteMany.mockResolvedValue({ count: 0 });
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

  it("rejects ranges longer than fourteen days", () => {
    expect(validateMealPlanRange("2026-05-12", "2026-05-26")).toEqual({
      fieldErrors: {
        endDate: getMealPlanMaxSpanMessage(),
      },
      ok: false,
      values: {
        endDate: "2026-05-26",
        startDate: "2026-05-12",
        title: "",
      },
    });
  });

  it("accepts fourteen-day ranges", () => {
    expect(validateMealPlanRange("2026-05-12", "2026-05-25")).toEqual({
      ok: true,
      values: {
        endDate: "2026-05-25",
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
      endDate: "2026-05-26",
      familyId: "family-1",
      startDate: "2026-05-12",
      title: " ",
      userId: "user-1",
    });

    expect(result).toEqual({
      fieldErrors: {
        endDate: getMealPlanMaxSpanMessage(),
        title: "Skriv inn et navn for ukeplanen.",
      },
      status: "VALIDATION_ERROR",
      values: {
        endDate: "2026-05-26",
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
          freezerItemId: "",

          recipeId: "kylling-taco",
          responsibleUserId: "user-2",
        },
        {
          date: new Date("2026-05-17T00:00:00.000Z"),
          note: null,
          freezerItemId: "",

          recipeId: "tomatsuppe",
          responsibleUserId: null,
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
            responsibleUserId: true,
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
          responsibleUserId: "user-2",
        },
        {
          date: new Date("2026-05-22T00:00:00.000Z"),
          mealPlanId: "meal-plan-copy",
          mealType: "DINNER",
          note: null,
          recipeId: "tomatsuppe",
          responsibleUserId: null,
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
          freezerItemId: "",

          recipeId: "kylling-taco",
        },
        {
          date: new Date("2026-05-16T00:00:00.000Z"),
          note: "Bare notat",
          freezerItemId: "",

          recipeId: null,
        },
        {
          date: new Date("2026-05-17T00:00:00.000Z"),
          note: "",
          freezerItemId: "",

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
          responsibleUserId: undefined,
        },
        {
          date: new Date("2026-05-21T00:00:00.000Z"),
          mealPlanId: "meal-plan-copy",
          mealType: "DINNER",
          note: "Bare notat",
          recipeId: null,
          responsibleUserId: undefined,
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
          freezerItem: null,
          freezerItemId: null,
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
        imageKey: null,
        prepMinutes: 25,
        reminderSuggestions: [
          {
            id: "dough",
            note: "Fra kjøleskapet",
            sortOrder: 1,
            timingKind: "HOURS_BEFORE_16",
            title: "Ta deigen ut av kjøleskapet",
          },
        ],
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
        imageUrl: null,
        prepMinutes: 25,
        reminderSuggestions: [
          {
            id: "dough",
            note: "Fra kjøleskapet",
            sortOrder: 1,
            timingKind: "HOURS_BEFORE_16",
            title: "Ta deigen ut av kjøleskapet",
          },
        ],
        tags: ["rask"],
        title: "Kyllingtaco",
      },
    ]);
    expect(result.recentlyUsedRecipeIds).toEqual([]);
    expect(dbMock.recipe.findMany).toHaveBeenCalledWith({
      orderBy: [{ title: "asc" }],
      select: {
        defaultServings: true,
        description: true,
        id: true,
        imageKey: true,
        prepMinutes: true,
        reminderSuggestions: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: {
            id: true,
            note: true,
            sortOrder: true,
            timingKind: true,
            title: true,
          },
        },
        tags: true,
        title: true,
      },
      where: {
        OR: [{ scope: "GLOBAL" }, { familyId: "family-1", scope: "FAMILY" }],
      },
    });
    expect(dbMock.mealPlanEntry.findMany).toHaveBeenCalled();
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

  it("prunes out-of-range entries and clamps shopping dates when shrinking a meal plan", async () => {
    const existingUpdatedAt = new Date("2026-05-01T12:00:00.000Z");
    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: new Date("2026-05-24T00:00:00.000Z"),
      id: "meal-plan-1",
      updatedAt: existingUpdatedAt,
    });
    dbMock.mealPlan.findUniqueOrThrow.mockResolvedValue({
      activeShoppingDate: new Date("2026-05-15T00:00:00.000Z"),
      approvedAt: null,
      approvedByUserId: null,
      copiedFromMealPlanId: null,
      createdAt: existingUpdatedAt,
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Langhelg",
      updatedAt: new Date("2026-05-01T13:00:00.000Z"),
    });

    const result = await updateMealPlan({
      endDate: "2026-05-18",
      expectedMealPlanUpdatedAt: existingUpdatedAt.toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      startDate: "2026-05-15",
      title: "Langhelg",
      userId: "user-1",
    });

    expect(result.status).toBe("UPDATED");
    expect(dbMock.mealPlan.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activeShoppingDate: new Date("2026-05-15T00:00:00.000Z"),
        endDate: new Date("2026-05-18T00:00:00.000Z"),
        startDate: new Date("2026-05-15T00:00:00.000Z"),
        title: "Langhelg",
      }),
      where: {
        id: "meal-plan-1",
        updatedAt: existingUpdatedAt,
      },
    });
    expect(dbMock.mealPlanEntry.deleteMany).toHaveBeenCalledWith({
      where: {
        mealPlanId: "meal-plan-1",
        OR: [
          { date: { lt: new Date("2026-05-15T00:00:00.000Z") } },
          { date: { gt: new Date("2026-05-18T00:00:00.000Z") } },
        ],
      },
    });
    expect(dbMock.manualShoppingItem.updateMany).toHaveBeenCalledWith({
      data: {
        buyOnDate: new Date("2026-05-15T00:00:00.000Z"),
      },
      where: {
        mealPlanId: "meal-plan-1",
        OR: [
          { buyOnDate: { lt: new Date("2026-05-15T00:00:00.000Z") } },
          { buyOnDate: { gt: new Date("2026-05-18T00:00:00.000Z") } },
        ],
      },
    });
    expect(dbMock.shoppingItemOverride.updateMany).toHaveBeenCalledWith({
      data: {
        postponedUntilDate: new Date("2026-05-15T00:00:00.000Z"),
      },
      where: {
        mealPlanId: "meal-plan-1",
        OR: [
          { postponedUntilDate: { lt: new Date("2026-05-15T00:00:00.000Z") } },
          { postponedUntilDate: { gt: new Date("2026-05-18T00:00:00.000Z") } },
        ],
      },
    });
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
    expect(dbMock.mealPlanShare.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "CLOSED",
      }),
      where: {
        mealPlanId: "meal-plan-1",
        status: "OPEN",
      },
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
          freezerItemId: "",

          recipeId: "kylling-taco",
          responsibleUserId: "",
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
          freezerItemId: "",

          recipeId: "kylling-taco",
          responsibleUserId: "",
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
          freezerItemId: "",

          recipeId: "kylling-taco",
          responsibleUserId: "",
        },
        {
          date: "2026-05-16",
          note: "",
          freezerItemId: "",

          recipeId: "",
          responsibleUserId: "",
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

  it("decrements freezer stock when assigning a freezer item", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-15T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });
    dbMock.mealPlanEntry.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    dbMock.familyFreezerItem.findMany
      .mockResolvedValueOnce([{ id: "freezer-1" }])
      .mockResolvedValueOnce([{ id: "freezer-1", quantity: 2 }]);

    const result = await saveMealPlanEntries({
      entries: [
        {
          date: "2026-05-15",
          freezerItemId: "freezer-1",
          note: "",
          recipeId: "",
          responsibleUserId: "",
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
    expect(dbMock.familyFreezerItem.updateMany).toHaveBeenCalledWith({
      data: {
        quantity: {
          increment: -1,
        },
      },
      where: {
        familyId: "family-1",
        id: "freezer-1",
        quantity: {
          gte: 1,
        },
      },
    });
    expect(dbMock.mealPlanEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          freezerItemId: "freezer-1",
          recipeId: null,
        }),
      }),
    );
  });

  it("rejects meal plans that assign unavailable freezer items", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-15T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });
    dbMock.familyFreezerItem.findMany.mockResolvedValueOnce([]);

    const result = await saveMealPlanEntries({
      entries: [
        {
          date: "2026-05-15",
          freezerItemId: "freezer-1",
          note: "",
          recipeId: "",
          responsibleUserId: "",
        },
      ],
      entryVersions: {},
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.status).toBe("VALIDATION_ERROR");
    expect(result.formError).toContain("fryserrett");
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
          freezerItemId: "",

          recipeId: "",
          responsibleUserId: "",
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
        freezerItemId: null,

        recipeId: null,
        responsibleUserId: null,
        updatedByUserId: "user-1",
      },
      update: {
        note: "Bruk rester til lunsj",
        freezerItemId: null,

        recipeId: null,
        responsibleUserId: null,
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
          freezerItemId: "",

          recipeId: "",
          responsibleUserId: "",
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
          freezerItemId: "",

          recipeId: "",
          responsibleUserId: "",
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
          freezerItemId: "",

          recipeId: "ukjent-rett",
          responsibleUserId: "",
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
          freezerItemId: "",

          recipeId: "ukjent-rett",
          responsibleUserId: "",
        },
      ],
    });
    expect(dbMock.mealPlanEntry.upsert).not.toHaveBeenCalled();
  });

  it("persists responsible family members on dinner entries", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-15T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });
    dbMock.recipe.findMany.mockResolvedValue([{ id: "kylling-taco" }]);
    listFamilyMembersMock.mockResolvedValue([
      {
        user: {
          displayName: "Ola",
          email: "ola@example.com",
          id: "user-2",
        },
      },
    ]);

    const result = await saveMealPlanEntries({
      entries: [
        {
          date: "2026-05-15",
          note: "",
          freezerItemId: "",

          recipeId: "kylling-taco",
          responsibleUserId: "user-2",
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
    expect(listFamilyMembersMock).toHaveBeenCalledWith("family-1");
    expect(dbMock.mealPlanEntry.upsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        responsibleUserId: "user-2",
      }),
      update: expect.objectContaining({
        responsibleUserId: "user-2",
      }),
      where: expect.any(Object),
    });
  });

  it("rejects responsible users who are not family members", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-15T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });
    dbMock.recipe.findMany.mockResolvedValue([{ id: "kylling-taco" }]);
    listFamilyMembersMock.mockResolvedValue([
      {
        user: {
          displayName: "Ola",
          email: "ola@example.com",
          id: "user-2",
        },
      },
    ]);

    const result = await saveMealPlanEntries({
      entries: [
        {
          date: "2026-05-15",
          note: "",
          freezerItemId: "",

          recipeId: "kylling-taco",
          responsibleUserId: "user-99",
        },
      ],
      entryVersions: {},
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      formError: "Minst en valgt ansvarlig er ikke medlem av familien.",
      status: "VALIDATION_ERROR",
      values: [
        {
          date: "2026-05-15",
          note: "",
          freezerItemId: "",

          recipeId: "kylling-taco",
          responsibleUserId: "user-99",
        },
      ],
    });
    expect(dbMock.mealPlanEntry.upsert).not.toHaveBeenCalled();
  });

  it("deletes days that only have a responsible member without a meal", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-15T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
    });
    listFamilyMembersMock.mockResolvedValue([
      {
        user: {
          displayName: "Ola",
          email: "ola@example.com",
          id: "user-2",
        },
      },
    ]);

    const result = await saveMealPlanEntries({
      entries: [
        {
          date: "2026-05-15",
          note: "",
          freezerItemId: "",

          recipeId: "",
          responsibleUserId: "user-2",
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
    expect(dbMock.mealPlanEntry.deleteMany).toHaveBeenCalledWith({
      where: {
        date: new Date("2026-05-15T00:00:00.000Z"),
        mealPlanId: "meal-plan-1",
        mealType: "DINNER",
      },
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

  it("collects recipe ids from dinners in the lookback window before the plan starts", async () => {
    dbMock.mealPlanEntry.findMany.mockResolvedValue([
      { recipeId: "recipe-a" },
      { recipeId: "recipe-b" },
      { recipeId: "recipe-c" },
    ]);

    const beforeDate = new Date("2026-05-22T00:00:00.000Z");
    const result = await getRecentlyUsedRecipeIds({
      beforeDate,
      currentMealPlanId: "meal-plan-3",
      familyId: "family-1",
    });

    expect(result).toEqual(new Set(["recipe-a", "recipe-b", "recipe-c"]));
    expect(dbMock.mealPlanEntry.findMany).toHaveBeenCalledWith({
      select: {
        recipeId: true,
      },
      where: {
        date: {
          gte: new Date("2026-05-08T00:00:00.000Z"),
          lt: beforeDate,
        },
        mealPlan: {
          familyId: "family-1",
          id: {
            not: "meal-plan-3",
          },
        },
        mealType: "DINNER",
        recipeId: {
          not: null,
        },
      },
    });
    expect(MEAL_PLAN_MAX_SPAN_DAYS).toBe(14);
  });

  it("aggregates dinner analytics by ingredient and recipe for a timeframe", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T10:00:00.000Z"));
    dbMock.mealPlanEntry.findMany.mockResolvedValue([
      {
        date: new Date("2026-08-09T00:00:00.000Z"),
        id: "entry-3",
        recipe: {
          id: "recipe-2",
          ingredients: [{ displayName: "Lime" }],
          title: "Fisketaco",
        },
        recipeId: "recipe-2",
      },
      {
        date: new Date("2026-08-08T00:00:00.000Z"),
        id: "entry-2",
        recipe: {
          id: "recipe-1",
          ingredients: [
            { displayName: "Tomat " },
            { displayName: "LIME" },
          ],
          title: "Taco",
        },
        recipeId: "recipe-1",
      },
      {
        date: new Date("2026-08-01T00:00:00.000Z"),
        id: "entry-1",
        recipe: {
          id: "recipe-1",
          ingredients: [{ displayName: "tomat" }],
          title: "Taco",
        },
        recipeId: "recipe-1",
      },
    ]);

    const result = await getDinnerAnalyticsForFamily({
      familyId: "family-1",
      timeframe: "90d",
      userId: "user-1",
    });

    expect(dbMock.mealPlanEntry.findMany).toHaveBeenCalledWith({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      select: {
        date: true,
        id: true,
        recipe: {
          select: {
            id: true,
            ingredients: {
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              select: {
                displayName: true,
              },
            },
            title: true,
          },
        },
        recipeId: true,
      },
      where: {
        date: {
          gte: new Date("2026-05-12T00:00:00.000Z"),
        },
        mealPlan: {
          familyId: "family-1",
        },
        mealType: "DINNER",
        recipeId: {
          not: null,
        },
      },
    });
    expect(result.family).toEqual({
      id: "family-1",
      name: "Solberg",
    });
    expect(result.mostUsedIngredients).toEqual([
      {
        count: 2,
        ingredientName: "Lime",
      },
      {
        count: 2,
        ingredientName: "Tomat",
      },
    ]);
    expect(result.mostUsedRecipes).toEqual([
      {
        count: 2,
        recipeId: "recipe-1",
        recipeTitle: "Taco",
      },
      {
        count: 1,
        recipeId: "recipe-2",
        recipeTitle: "Fisketaco",
      },
    ]);
    expect(result.latestRecipesUsed).toEqual([
      {
        date: new Date("2026-08-09T00:00:00.000Z"),
        recipeId: "recipe-2",
        recipeTitle: "Fisketaco",
      },
      {
        date: new Date("2026-08-08T00:00:00.000Z"),
        recipeId: "recipe-1",
        recipeTitle: "Taco",
      },
      {
        date: new Date("2026-08-01T00:00:00.000Z"),
        recipeId: "recipe-1",
        recipeTitle: "Taco",
      },
    ]);
    expect(result.timeframe).toBe("90d");
    expect(result.timeframeStartDate).toEqual(
      new Date("2026-05-12T00:00:00.000Z"),
    );

    vi.useRealTimers();
  });

  it("does not apply a date filter for all-time dinner analytics", async () => {
    dbMock.mealPlanEntry.findMany.mockResolvedValue([]);

    await getDinnerAnalyticsForFamily({
      familyId: "family-1",
      timeframe: "all",
      userId: "user-1",
    });

    expect(dbMock.mealPlanEntry.findMany).toHaveBeenCalledWith({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      select: {
        date: true,
        id: true,
        recipe: {
          select: {
            id: true,
            ingredients: {
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              select: {
                displayName: true,
              },
            },
            title: true,
          },
        },
        recipeId: true,
      },
      where: {
        mealPlan: {
          familyId: "family-1",
        },
        mealType: "DINNER",
        recipeId: {
          not: null,
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
          freezerItem: null,
          freezerItemId: null,
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
          freezerItem: null,
          freezerItemId: null,
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
    dbMock.mealPlanEntry.findMany.mockResolvedValue([
      { recipeId: "kylling-taco" },
    ]);
    dbMock.recipe.findMany.mockResolvedValue([{ id: "kylling-taco" }]);

    const result = await autoFillMealPlanEntries({
      familyId: "family-1",
      mealPlanId: "meal-plan-3",
      userId: "user-1",
    });

    expect(result).toEqual({
      formError:
        `Ingen tilgjengelige oppskrifter etter a ha utelatt middager fra de siste ${MEAL_PLAN_MAX_SPAN_DAYS} dagene.`,
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
          freezerItem: null,
          freezerItemId: null,
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
    dbMock.mealPlanEntry.findMany
      .mockResolvedValueOnce([{ recipeId: "recipe-a" }])
      .mockResolvedValue([
        {
          date: new Date("2026-05-22T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T12:00:00.000Z"),
        },
      ]);
    dbMock.recipe.findMany
      .mockResolvedValueOnce([
        { id: "recipe-a" },
        { id: "recipe-b" },
        { id: "recipe-c" },
      ])
      .mockResolvedValueOnce([{ id: "recipe-b" }, { id: "recipe-c" }, { id: "recipe-d" }]);

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
    dbMock.mealPlanEntry.findMany.mockResolvedValue([]);
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

describe("unionMealPlanDateRanges", () => {
  it("returns the same dates as getMealPlanDateRange for a single plan", () => {
    expect(
      unionMealPlanDateRanges([
        {
          endDate: new Date("2026-05-18T00:00:00.000Z"),
          startDate: new Date("2026-05-15T00:00:00.000Z"),
        },
      ]),
    ).toEqual(["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"]);
  });

  it("deduplicates overlapping plan ranges", () => {
    expect(
      unionMealPlanDateRanges([
        {
          endDate: new Date("2026-05-17T00:00:00.000Z"),
          startDate: new Date("2026-05-15T00:00:00.000Z"),
        },
        {
          endDate: new Date("2026-05-18T00:00:00.000Z"),
          startDate: new Date("2026-05-17T00:00:00.000Z"),
        },
      ]),
    ).toEqual(["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"]);
  });

  it("unions adjacent non-overlapping plans without gap dates", () => {
    expect(
      unionMealPlanDateRanges([
        {
          endDate: new Date("2026-05-17T00:00:00.000Z"),
          startDate: new Date("2026-05-15T00:00:00.000Z"),
        },
        {
          endDate: new Date("2026-05-21T00:00:00.000Z"),
          startDate: new Date("2026-05-19T00:00:00.000Z"),
        },
      ]),
    ).toEqual([
      "2026-05-15",
      "2026-05-16",
      "2026-05-17",
      "2026-05-19",
      "2026-05-20",
      "2026-05-21",
    ]);
  });
});
