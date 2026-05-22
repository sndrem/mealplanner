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

vi.mock("../lib/meal-plan-share.server", () => ({
  approveMealPlanFromShareReview: vi.fn(),
  getMealPlanShareReviewData: vi.fn(),
  recordShareViewed: vi.fn(),
  upsertDayReviewComment: vi.fn(),
}));

import { requireUser } from "../lib/auth.server";
import {
  approveMealPlanFromShareReview,
  getMealPlanShareReviewData,
  recordShareViewed,
  upsertDayReviewComment,
} from "../lib/meal-plan-share.server";
import { action, loader } from "./family-meal-plan-review";

const mockUser = {
  displayName: "Kari",
  email: "kari@example.com",
  id: "user-2",
  isGlobalAdmin: false,
};

describe("family meal plan review route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads review data when shareId is provided", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(recordShareViewed).mockResolvedValue({ status: "VIEWED" });
    vi.mocked(getMealPlanShareReviewData).mockResolvedValue({
      canApprove: true,
      days: [],
      family: { id: "family-1", name: "Solberg" },
      isSharedByCurrentUser: false,
      mealPlan: {
        endDate: "2026-05-18",
        id: "meal-plan-1",
        startDate: "2026-05-15",
        status: "DRAFT",
        title: "Uke 20",
      },
      recipientStatus: "VIEWED",
      share: {
        createdAt: "2026-05-20T10:00:00.000Z",
        id: "share-1",
        message: null,
        sharedByDisplayName: "Ola",
      },
      shareStatus: "OPEN",
    });

    const result = await loader({
      params: { familyId: "family-1", mealPlanId: "meal-plan-1" },
      request: new Request(
        "http://localhost/families/family-1/meal-plans/meal-plan-1/review?shareId=share-1",
      ),
    } as never);

    expect(result.shareId).toBe("share-1");
    expect(recordShareViewed).toHaveBeenCalled();
  });

  it("saves quick-response feedback from the review action", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(upsertDayReviewComment).mockResolvedValue({
      comment: {
        addressedAt: null,
        addressedByDisplayName: null,
        authorDisplayName: "Kari",
        authorUserId: "user-2",
        body: null,
        createdAt: "2026-05-20T10:00:00.000Z",
        date: "2026-05-15",
        feedbackLabel: "Ja!",
        id: "comment-1",
        quickResponse: "YES",
        shareId: "share-1",
        updatedAt: "2026-05-20T10:00:00.000Z",
      },
      status: "SAVED",
    });

    const formData = new FormData();
    formData.set("intent", "save-day-feedback");
    formData.set("shareId", "share-1");
    formData.set("date", "2026-05-15");
    formData.set("quickResponse", "YES");

    const result = await action({
      params: { familyId: "family-1", mealPlanId: "meal-plan-1" },
      request: new Request("http://localhost", {
        body: formData,
        method: "POST",
      }),
    } as never);

    expect(result.ok).toBe(true);
    expect(upsertDayReviewComment).toHaveBeenCalledWith(
      expect.objectContaining({
        quickResponse: "YES",
        userId: "user-2",
      }),
    );
  });

  it("approves the meal plan without requiring day feedback", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(approveMealPlanFromShareReview).mockResolvedValue({
      mealPlan: { id: "meal-plan-1", status: "APPROVED" },
      status: "APPROVED",
    } as never);

    const formData = new FormData();
    formData.set("intent", "approve-meal-plan");
    formData.set("shareId", "share-1");

    const response = await action({
      params: { familyId: "family-1", mealPlanId: "meal-plan-1" },
      request: new Request(
        "http://localhost/families/family-1/meal-plans/meal-plan-1/review?shareId=share-1",
        {
          body: formData,
          method: "POST",
        },
      ),
    } as never);

    expect(approveMealPlanFromShareReview).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      shareId: "share-1",
      userId: "user-2",
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/meal-plans/reviews?notice=meal-plan-approved",
    );
  });
});
