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

vi.mock("../lib/meal-plan.server", () => ({
  approveMealPlanProposal: vi.fn(),
  formatDateOnly: vi.fn((date: Date) => date.toISOString().slice(0, 10)),
  getMealPlanPlanningData: vi.fn(),
  saveMealPlanEntries: vi.fn(),
}));

import { requireUser } from "../lib/auth.server";
import {
  approveMealPlanProposal,
  getMealPlanPlanningData,
  saveMealPlanEntries,
} from "../lib/meal-plan.server";
import { action, loader } from "./family-meal-plan-proposal";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildPlanningData({
  status = "PROPOSED",
}: {
  status?: "APPROVED" | "DRAFT" | "PROPOSED";
} = {}) {
  return {
    family: {
      id: "family-1",
      name: "Solberg",
    },
    freezerItems: [],
    mealPlan: {
      activeShoppingDate: new Date("2026-05-11T00:00:00.000Z"),
      approvedAt: null,
      approvedByUserId: null,
      copiedFromMealPlanId: null,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-05-17T00:00:00.000Z"),
      entries: [],
      id: "proposal-1",
      startDate: new Date("2026-05-11T00:00:00.000Z"),
      status,
      title: "Uke 20",
      updatedAt: new Date("2026-05-01T12:00:00.000Z"),
    },
    recentlyUsedRecipeIds: [],
    recipes: [],
    userRole: "ADMIN",
    visibleDates: ["2026-05-11", "2026-05-12"],
  };
}

describe("family meal plan proposal route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated visitors to login with redirectTo", async () => {
    const redirectResponse = new Response(null, {
      headers: {
        Location:
          "/login?redirectTo=%2Ffamilies%2Ffamily-1%2Fmeal-plans%2Fproposal-1%2Fproposal",
      },
      status: 302,
    });
    vi.mocked(requireUser).mockRejectedValue(redirectResponse);

    await expect(
      loader({
        params: { familyId: "family-1", mealPlanId: "proposal-1" },
        request: new Request(
          "http://localhost/families/family-1/meal-plans/proposal-1/proposal",
        ),
      } as never),
    ).rejects.toBe(redirectResponse);
  });

  it("loads a proposed meal plan for review", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getMealPlanPlanningData).mockResolvedValue(
      buildPlanningData() as never,
    );

    const result = await loader({
      params: { familyId: "family-1", mealPlanId: "proposal-1" },
      request: new Request(
        "http://localhost/families/family-1/meal-plans/proposal-1/proposal",
      ),
    } as never);

    expect(result.mealPlan.status).toBe("PROPOSED");
    expect(result.visibleDates).toEqual(["2026-05-11", "2026-05-12"]);
  });

  it("maps stored dinners onto each proposal day", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getMealPlanPlanningData).mockResolvedValue({
      ...buildPlanningData(),
      mealPlan: {
        ...buildPlanningData().mealPlan,
        entries: [
          {
            date: new Date("2026-05-11T00:00:00.000Z"),
            freezerItem: null,
            freezerItemId: null,
            mealType: "DINNER",
            note: "Bruk extra ost",
            recipe: {
              imageUrl: "https://img.example/taco.jpg",
              title: "Taco",
            },
            recipeId: "recipe-taco",
            updatedAt: new Date("2026-05-10T12:00:00.000Z"),
          },
        ],
      },
    } as never);

    const result = await loader({
      params: { familyId: "family-1", mealPlanId: "proposal-1" },
      request: new Request(
        "http://localhost/families/family-1/meal-plans/proposal-1/proposal",
      ),
    } as never);

    expect(result.entriesByDate["2026-05-11"]).toMatchObject({
      freezerItemId: "",
      note: "Bruk extra ost",
      recipeId: "recipe-taco",
      recipeImageUrl: "https://img.example/taco.jpg",
      recipeTitle: "Taco",
    });
    expect(result.entriesByDate["2026-05-12"]).toMatchObject({
      recipeId: "",
      recipeTitle: "",
    });
  });

  it("shows an already-approved proposal without editing", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getMealPlanPlanningData).mockResolvedValue(
      buildPlanningData({ status: "APPROVED" }) as never,
    );

    const result = await loader({
      params: { familyId: "family-1", mealPlanId: "proposal-1" },
      request: new Request(
        "http://localhost/families/family-1/meal-plans/proposal-1/proposal",
      ),
    } as never);

    expect(result.mealPlan.status).toBe("APPROVED");
  });

  it("redirects draft plans to the regular ukeplan", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getMealPlanPlanningData).mockResolvedValue(
      buildPlanningData({ status: "DRAFT" }) as never,
    );

    await expect(
      loader({
        params: { familyId: "family-1", mealPlanId: "proposal-1" },
        request: new Request(
          "http://localhost/families/family-1/meal-plans/proposal-1/proposal",
        ),
      } as never),
    ).rejects.toMatchObject({
      status: 302,
    });
  });

  it("approves a proposal and redirects to the ukeplan", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(saveMealPlanEntries).mockResolvedValue({
      status: "UPDATED",
    });
    vi.mocked(approveMealPlanProposal).mockResolvedValue({
      status: "APPROVED",
    } as never);

    const formData = new FormData();
    formData.set("intent", "approve-meal-plan");
    formData.append("entryDate", "2026-05-11");
    formData.set("mealSelection:2026-05-11", "recipe:recipe-taco");
    formData.set("note:2026-05-11", "");
    formData.set("entryUpdatedAt:2026-05-11", "");

    const result = await action({
      params: { familyId: "family-1", mealPlanId: "proposal-1" },
      request: new Request(
        "http://localhost/families/family-1/meal-plans/proposal-1/proposal",
        {
          body: formData,
          method: "POST",
        },
      ),
    } as never);

    expect(saveMealPlanEntries).toHaveBeenCalled();
    expect(approveMealPlanProposal).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "proposal-1",
      userId: "user-1",
    });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/meal-plans/proposal-1?notice=meal-plan-approved",
    );
  });
});
