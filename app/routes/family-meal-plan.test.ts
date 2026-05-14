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
    approveMealPlan: vi.fn(),
    formatDateOnly: vi.fn((date: Date) => date.toISOString().slice(0, 10)),
    getMealPlanPlanningData: vi.fn(),
    reopenMealPlan: vi.fn(),
    saveMealPlanEntries: vi.fn(),
    updateMealPlan: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import {
  approveMealPlan,
  getMealPlanPlanningData,
  reopenMealPlan,
  saveMealPlanEntries,
  updateMealPlan,
} from "../lib/meal-plan.server";
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

  it("loads planning data with visible dates, entries, and recipe options", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getMealPlanPlanningData).mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      mealPlan: {
        activeShoppingDate: new Date("2026-05-15T00:00:00.000Z"),
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
            note: "Bruk rester til lunsj",
            recipe: null,
            recipeId: "",
            updatedAt: new Date("2026-05-01T12:00:00.000Z"),
          },
        ],
        id: "meal-plan-1",
        startDate: new Date("2026-05-15T00:00:00.000Z"),
        status: "DRAFT",
        title: "Langhelg",
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
      },
      recipes: [
        {
          defaultServings: 4,
          description: "Rask middagsfavoritt.",
          id: "kylling-taco",
          prepMinutes: 25,
          tags: ["rask"],
          title: "Kyllingtaco",
        },
      ],
      userRole: "ADMIN",
      visibleDates: ["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"],
    });

    const result = await loader({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1?notice=meal-plan-created"),
    });

    expect(getMealPlanPlanningData).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(result).toEqual({
      calendarExportDates: [],
      family: {
        id: "family-1",
        name: "Solberg",
      },
      mealPlan: {
        activeShoppingDate: "2026-05-15",
        approvedByUserId: null,
        approvedAt: null,
        copiedFromMealPlanId: null,
        createdAt: new Date("2026-05-01T12:00:00.000Z"),
        endDate: "2026-05-18",
        entries: undefined,
        id: "meal-plan-1",
        startDate: "2026-05-15",
        status: "DRAFT",
        title: "Langhelg",
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
      },
      notice: "meal-plan-created",
      recipes: [
        {
          defaultServings: 4,
          description: "Rask middagsfavoritt.",
          id: "kylling-taco",
          prepMinutes: 25,
          tags: ["rask"],
          title: "Kyllingtaco",
        },
      ],
      userRole: "ADMIN",
      visibleDates: ["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"],
      entriesByDate: {
        "2026-05-15": {
          note: "Bruk rester til lunsj",
          recipeId: "",
        },
        "2026-05-16": {
          note: "",
          recipeId: "",
        },
        "2026-05-17": {
          note: "",
          recipeId: "",
        },
        "2026-05-18": {
          note: "",
          recipeId: "",
        },
      },
    });
  });

  it("returns planner validation errors from the server module", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(saveMealPlanEntries).mockResolvedValue({
      formError: "En av dagene ligger utenfor den aktive perioden.",
      status: "VALIDATION_ERROR",
      values: [
        {
          date: "2026-05-15",
          note: "Bruk rester til lunsj",
          recipeId: "",
        },
        {
          date: "2026-05-16",
          note: "",
          recipeId: "kylling-taco",
        },
      ],
    });

    const formData = new FormData();
    formData.set("intent", "save-meal-plan-entries");
    formData.append("entryDate", "2026-05-15");
    formData.append("entryDate", "2026-05-16");
    formData.set("note:2026-05-15", "Bruk rester til lunsj");
    formData.set("recipeId:2026-05-15", "");
    formData.set("note:2026-05-16", "");
    formData.set("recipeId:2026-05-16", "kylling-taco");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1", formData),
    });

    expect(saveMealPlanEntries).toHaveBeenCalledWith({
      entries: [
        {
          date: "2026-05-15",
          note: "Bruk rester til lunsj",
          recipeId: "",
        },
        {
          date: "2026-05-16",
          note: "",
          recipeId: "kylling-taco",
        },
      ],
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(result).toEqual({
      entryFormError: "En av dagene ligger utenfor den aktive perioden.",
      entryValues: {
        "2026-05-15": {
          note: "Bruk rester til lunsj",
          recipeId: "",
        },
        "2026-05-16": {
          note: "",
          recipeId: "kylling-taco",
        },
      },
      intent: "save-meal-plan-entries",
    });
  });

  it("redirects with an explicit notice after saving meal plan entries", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(saveMealPlanEntries).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "save-meal-plan-entries");
    formData.append("entryDate", "2026-05-15");
    formData.set("recipeId:2026-05-15", "kylling-taco");
    formData.set("note:2026-05-15", "");

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
      "http://localhost/families/family-1/meal-plans/meal-plan-1?notice=meal-plan-entries-saved",
    );
  });

  it("redirects with an explicit notice after approving a meal plan", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(approveMealPlan).mockResolvedValue({
      mealPlan: {
        activeShoppingDate: new Date("2026-05-15T00:00:00.000Z"),
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
      },
      status: "APPROVED",
    });

    const formData = new FormData();
    formData.set("intent", "approve-meal-plan");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1", formData),
    });

    expect(approveMealPlan).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1/meal-plans/meal-plan-1?notice=meal-plan-approved",
    );
  });

  it("redirects with an explicit notice after reopening a meal plan", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(reopenMealPlan).mockResolvedValue({
      mealPlan: {
        activeShoppingDate: new Date("2026-05-15T00:00:00.000Z"),
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
      },
      status: "REOPENED",
    });

    const formData = new FormData();
    formData.set("intent", "reopen-meal-plan");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1", formData),
    });

    expect(reopenMealPlan).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1/meal-plans/meal-plan-1?notice=meal-plan-reopened",
    );
  });

  it("returns approval transition errors from the server module", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(approveMealPlan).mockResolvedValue({
      formError: "Ukeplanen er allerede godkjent.",
      status: "INVALID_TRANSITION",
    });

    const formData = new FormData();
    formData.set("intent", "approve-meal-plan");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1", formData),
    });

    expect(result).toEqual({
      intent: "approve-meal-plan",
      statusFormError: "Ukeplanen er allerede godkjent.",
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
    formData.set("startDate", "2026-05-15");
    formData.set("endDate", "2026-05-18");

    const result = await action({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans/meal-plan-1", formData),
    });

    expect(result).toEqual({
      fieldErrors: {
        endDate: "Sluttdatoen kan ikke være før startdatoen.",
      },
      intent: "update-meal-plan",
      values: {
        endDate: "2026-05-15",
        startDate: "2026-05-18",
        title: "Langhelg",
      },
    });
  });

  it("throws a not-found response when the meal plan disappears before an entry save", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(saveMealPlanEntries).mockResolvedValue({
      status: "NOT_FOUND",
    });

    const formData = new FormData();
    formData.set("intent", "save-meal-plan-entries");
    formData.append("entryDate", "2026-05-15");
    formData.set("recipeId:2026-05-15", "kylling-taco");
    formData.set("note:2026-05-15", "");

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
