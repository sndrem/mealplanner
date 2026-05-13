import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/meal-plan.server", () => {
  return {
    formatDateOnly: vi.fn((date: Date) => date.toISOString().slice(0, 10)),
    getMealPlanForFamily: vi.fn(),
    updateMealPlan: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { getMealPlanForFamily, updateMealPlan } from "../lib/meal-plan.server";
import { action, loader } from "./family-meal-plan";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(url = "http://localhost/families/family-1/meal-plans/meal-plan-1", formData?: FormData) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family meal plan route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads a serialized meal plan for metadata editing", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getMealPlanForFamily).mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      mealPlan: {
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
      },
      userRole: "ADMIN",
    });

    const result = await loader({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1?notice=meal-plan-created"),
    });

    expect(getMealPlanForFamily).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(result).toEqual({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      mealPlan: {
        approvedAt: null,
        approvedByUserId: null,
        copiedFromMealPlanId: null,
        createdAt: new Date("2026-05-01T12:00:00.000Z"),
        endDate: "2026-05-18",
        id: "meal-plan-1",
        startDate: "2026-05-15",
        status: "DRAFT",
        title: "Langhelg",
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
      },
      notice: "meal-plan-created",
    });
  });

  it("returns update validation errors from the server module", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateMealPlan).mockResolvedValue({
      fieldErrors: {
        endDate: "Sluttdatoen kan ikke være før startdatoen.",
      },
      status: "VALIDATION_ERROR",
      values: {
        endDate: "2026-05-15",
        startDate: "2026-05-18",
        title: "Langhelg",
      },
    });

    const formData = new FormData();
    formData.set("intent", "update-meal-plan");
    formData.set("title", "Langhelg");
    formData.set("startDate", "2026-05-18");
    formData.set("endDate", "2026-05-15");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1", formData),
    });

    expect(updateMealPlan).toHaveBeenCalledWith({
      endDate: "2026-05-15",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      startDate: "2026-05-18",
      title: "Langhelg",
      userId: "user-1",
    });
    expect(result).toEqual({
      fieldErrors: {
        endDate: "Sluttdatoen kan ikke være før startdatoen.",
      },
      values: {
        endDate: "2026-05-15",
        startDate: "2026-05-18",
        title: "Langhelg",
      },
    });
  });

  it("redirects with an explicit notice after updating a meal plan", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateMealPlan).mockResolvedValue({
      mealPlan: {
        approvedAt: null,
        approvedByUserId: null,
        copiedFromMealPlanId: null,
        createdAt: new Date("2026-05-01T12:00:00.000Z"),
        endDate: new Date("2026-05-18T00:00:00.000Z"),
        id: "meal-plan-1",
        startDate: new Date("2026-05-15T00:00:00.000Z"),
        status: "DRAFT",
        title: "Langhelg",
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "update-meal-plan");
    formData.set("title", "Langhelg");
    formData.set("startDate", "2026-05-15");
    formData.set("endDate", "2026-05-18");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1", formData),
    });

    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1/meal-plans/meal-plan-1?notice=meal-plan-updated",
    );
  });

  it("throws a not-found response when the meal plan disappears before update", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateMealPlan).mockResolvedValue({
      status: "NOT_FOUND",
    });

    const formData = new FormData();
    formData.set("intent", "update-meal-plan");
    formData.set("title", "Langhelg");
    formData.set("startDate", "2026-05-15");
    formData.set("endDate", "2026-05-18");

    await expect(
      action({
        params: {
          familyId: "family-1",
          mealPlanId: "meal-plan-1",
        },
        request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1", formData),
      }),
    ).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
    });
  });
});
