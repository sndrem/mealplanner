import { beforeEach, describe, expect, it, vi } from "vitest";

import { MealPlanReviewQuickResponse, MealPlanStatus } from "@prisma/client";

const { dbMock, listFamilyMembersForCollaborationMock, requireFamilyMembershipMock } =
  vi.hoisted(() => {
    return {
      dbMock: {
        mealPlan: {
          findFirst: vi.fn(),
        },
        mealPlanReviewComment: {
          findFirst: vi.fn(),
          update: vi.fn(),
          upsert: vi.fn(),
        },
        mealPlanShare: {
          create: vi.fn(),
          findFirst: vi.fn(),
          findMany: vi.fn(),
          updateMany: vi.fn(),
        },
        mealPlanShareRecipient: {
          count: vi.fn(),
          create: vi.fn(),
          findFirst: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
        },
      },
      listFamilyMembersForCollaborationMock: vi.fn(),
      requireFamilyMembershipMock: vi.fn(),
    };
  });

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  listFamilyMembersForCollaboration: listFamilyMembersForCollaborationMock,
  requireFamilyMembership: requireFamilyMembershipMock,
}));

vi.mock("./meal-plan.server", async () => {
  const actual = await vi.importActual<typeof import("./meal-plan.server")>(
    "./meal-plan.server",
  );

  return {
    ...actual,
    approveMealPlan: vi.fn(),
  };
});

import { approveMealPlan } from "./meal-plan.server";
import {
  approveMealPlanFromShareReview,
  closeSharesForMealPlan,
  countPendingReviewsForUser,
  createMealPlanShare,
  listPendingReviewsForUser,
  markReviewCommentAddressed,
  upsertDayReviewComment,
} from "./meal-plan-share.server";

const mockMembership = {
  family: { id: "family-1", joinCode: "ABC123", name: "Solberg" },
  familyId: "family-1",
  id: "membership-1",
  role: "ADMIN",
  userId: "user-1",
};

const draftMealPlan = {
  endDate: new Date("2026-05-18T00:00:00.000Z"),
  id: "meal-plan-1",
  startDate: new Date("2026-05-15T00:00:00.000Z"),
  status: MealPlanStatus.DRAFT,
};

describe("meal-plan-share.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyMembershipMock.mockResolvedValue(mockMembership);
    dbMock.mealPlan.findFirst.mockResolvedValue(draftMealPlan);
    listFamilyMembersForCollaborationMock.mockResolvedValue([
      {
        id: "membership-1",
        role: "ADMIN",
        user: { displayName: "Ola", email: "ola@example.com", id: "user-1" },
      },
      {
        id: "membership-2",
        role: "MEMBER",
        user: { displayName: "Kari", email: "kari@example.com", id: "user-2" },
      },
    ]);
  });

  it("creates a whole-family share including the sharer as recipient", async () => {
    dbMock.mealPlanShare.findFirst.mockResolvedValue(null);
    dbMock.mealPlanShare.create.mockResolvedValue({
      closedAt: null,
      createdAt: new Date("2026-05-20T10:00:00.000Z"),
      id: "share-1",
      mealPlanId: "meal-plan-1",
      message: "Sjekk middagene",
      sharedByUser: { displayName: "Ola", id: "user-1" },
      status: "OPEN",
      wholeFamily: true,
    });

    const result = await createMealPlanShare({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      message: "Sjekk middagene",
      recipientUserIds: [],
      userId: "user-1",
      wholeFamily: true,
    });

    expect(result.status).toBe("CREATED");
    expect(dbMock.mealPlanShare.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipients: {
            create: expect.arrayContaining([
              { userId: "user-1" },
              { userId: "user-2" },
            ]),
          },
          wholeFamily: true,
        }),
      }),
    );
  });

  it("includes the sharer when sharing with selected members", async () => {
    dbMock.mealPlanShare.findFirst.mockResolvedValue(null);
    dbMock.mealPlanShare.create.mockResolvedValue({
      closedAt: null,
      createdAt: new Date("2026-05-20T10:00:00.000Z"),
      id: "share-1",
      mealPlanId: "meal-plan-1",
      message: null,
      sharedByUser: { displayName: "Ola", id: "user-1" },
      status: "OPEN",
      wholeFamily: false,
    });

    const result = await createMealPlanShare({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      recipientUserIds: ["user-2"],
      userId: "user-1",
      wholeFamily: false,
    });

    expect(result.status).toBe("CREATED");
    expect(dbMock.mealPlanShare.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipients: {
            create: expect.arrayContaining([
              { userId: "user-1" },
              { userId: "user-2" },
            ]),
          },
        }),
      }),
    );
  });

  it("rejects creating a second open share for the same meal plan", async () => {
    dbMock.mealPlanShare.findFirst.mockResolvedValue({
      id: "share-existing",
    });

    const result = await createMealPlanShare({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      recipientUserIds: ["user-2"],
      userId: "user-1",
      wholeFamily: false,
    });

    expect(result.status).toBe("ALREADY_SHARED");
    expect(dbMock.mealPlanShare.create).not.toHaveBeenCalled();
  });

  it("rejects share creation without recipients", async () => {
    dbMock.mealPlanShare.findFirst.mockResolvedValue(null);
    const result = await createMealPlanShare({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      recipientUserIds: [],
      userId: "user-1",
      wholeFamily: false,
    });

    expect(result.status).toBe("VALIDATION_ERROR");
  });

  it("upserts a quick-response comment and marks recipient responded", async () => {
    dbMock.mealPlanShareRecipient.findFirst.mockResolvedValue({
      id: "recipient-1",
      share: {
        mealPlan: draftMealPlan,
        status: "OPEN",
      },
      status: "VIEWED",
    });
    dbMock.mealPlanReviewComment.upsert.mockResolvedValue({
      addressedAt: null,
      addressedByUser: null,
      authorUser: { displayName: "Kari", id: "user-2" },
      body: null,
      createdAt: new Date("2026-05-20T10:00:00.000Z"),
      date: new Date("2026-05-15T00:00:00.000Z"),
      id: "comment-1",
      quickResponse: MealPlanReviewQuickResponse.FISH_AGAIN,
      shareId: "share-1",
      updatedAt: new Date("2026-05-20T10:00:00.000Z"),
    });

    const result = await upsertDayReviewComment({
      date: "2026-05-15",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      quickResponse: "FISH_AGAIN",
      shareId: "share-1",
      userId: "user-2",
    });

    expect(result.status).toBe("SAVED");
    expect(dbMock.mealPlanReviewComment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          body: null,
          quickResponse: MealPlanReviewQuickResponse.FISH_AGAIN,
        }),
        update: expect.objectContaining({
          body: null,
          quickResponse: MealPlanReviewQuickResponse.FISH_AGAIN,
        }),
      }),
    );
    expect(dbMock.mealPlanShareRecipient.update).toHaveBeenCalled();
  });

  it("marks a review comment as addressed", async () => {
    dbMock.mealPlanReviewComment.findFirst.mockResolvedValue({
      addressedAt: null,
      addressedByUser: null,
      authorUser: { displayName: "Kari", id: "user-2" },
      body: null,
      createdAt: new Date("2026-05-20T10:00:00.000Z"),
      date: new Date("2026-05-15T00:00:00.000Z"),
      id: "comment-1",
      quickResponse: MealPlanReviewQuickResponse.YES,
      shareId: "share-1",
      updatedAt: new Date("2026-05-20T10:00:00.000Z"),
    });
    dbMock.mealPlanReviewComment.update.mockResolvedValue({
      addressedAt: new Date("2026-05-20T11:00:00.000Z"),
      addressedByUser: { displayName: "Ola", id: "user-1" },
      authorUser: { displayName: "Kari", id: "user-2" },
      body: null,
      createdAt: new Date("2026-05-20T10:00:00.000Z"),
      date: new Date("2026-05-15T00:00:00.000Z"),
      id: "comment-1",
      quickResponse: MealPlanReviewQuickResponse.YES,
      shareId: "share-1",
      updatedAt: new Date("2026-05-20T10:00:00.000Z"),
    });

    const result = await markReviewCommentAddressed({
      commentId: "comment-1",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.status).toBe("ADDRESSED");
    expect(result.comment?.feedbackLabel).toBe("Ja!");
  });

  it("approves a meal plan from share review without day comments", async () => {
    dbMock.mealPlanShareRecipient.findFirst.mockResolvedValue({
      id: "recipient-1",
      share: {
        mealPlan: draftMealPlan,
        status: "OPEN",
      },
      status: "VIEWED",
    });
    dbMock.mealPlan.findFirst.mockResolvedValue({
      ...draftMealPlan,
      entries: [],
      updatedAt: new Date("2026-05-20T10:00:00.000Z"),
    });
    vi.mocked(approveMealPlan).mockResolvedValue({
      mealPlan: { id: "meal-plan-1", status: "APPROVED" },
      status: "APPROVED",
    } as never);
    dbMock.mealPlanShareRecipient.update.mockResolvedValue({});

    const result = await approveMealPlanFromShareReview({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      shareId: "share-1",
      userId: "user-2",
    });

    expect(result.status).toBe("APPROVED");
    expect(approveMealPlan).toHaveBeenCalled();
    expect(dbMock.mealPlanShareRecipient.update).toHaveBeenCalled();
  });

  it("excludes self-initiated shares from pending review count", async () => {
    dbMock.mealPlanShareRecipient.count.mockResolvedValue(1);

    await countPendingReviewsForUser({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(dbMock.mealPlanShareRecipient.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          share: expect.objectContaining({
            sharedByUserId: {
              not: "user-1",
            },
          }),
        }),
      }),
    );
  });

  it("backfills sharer recipient rows when listing reviews", async () => {
    dbMock.mealPlanShare.findMany.mockResolvedValue([{ id: "share-1" }]);
    dbMock.mealPlanShareRecipient.findFirst.mockResolvedValue(null);
    dbMock.mealPlanShare.findFirst.mockResolvedValue({
      id: "share-1",
      sharedByUserId: "user-1",
      status: "OPEN",
    });
    dbMock.mealPlanShareRecipient.create.mockResolvedValue({ id: "recipient-1" });
    dbMock.mealPlanShareRecipient.findMany.mockResolvedValue([
      {
        id: "recipient-1",
        respondedAt: null,
        share: {
          closedAt: null,
          createdAt: new Date("2026-05-20T10:00:00.000Z"),
          id: "share-1",
          mealPlan: {
            endDate: draftMealPlan.endDate,
            id: "meal-plan-1",
            startDate: draftMealPlan.startDate,
            title: "Uke 20",
          },
          mealPlanId: "meal-plan-1",
          message: "Sjekk middagene",
          sharedByUser: { displayName: "Ola", id: "user-1" },
          status: "OPEN",
          wholeFamily: true,
        },
        status: "PENDING",
        viewedAt: null,
      },
    ]);

    const result = await listPendingReviewsForUser({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(dbMock.mealPlanShareRecipient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          shareId: "share-1",
          status: "PENDING",
          userId: "user-1",
        },
      }),
    );
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]?.isSharedByCurrentUser).toBe(true);
  });

  it("closes open shares for a meal plan", async () => {
    dbMock.mealPlanShare.updateMany.mockResolvedValue({ count: 1 });

    await closeSharesForMealPlan({ mealPlanId: "meal-plan-1" });

    expect(dbMock.mealPlanShare.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mealPlanId: "meal-plan-1",
          status: "OPEN",
        },
      }),
    );
  });
});
