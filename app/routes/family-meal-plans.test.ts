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
    copyMealPlan: vi.fn(),
    createMealPlan: vi.fn(),
    deleteMealPlan: vi.fn(),
    formatDateOnly: vi.fn((date: Date) => date.toISOString().slice(0, 10)),
    listMealPlansForFamily: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { copyMealPlan, createMealPlan, deleteMealPlan, listMealPlansForFamily } from "../lib/meal-plan.server";
import { action, loader } from "./family-meal-plans";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(url = "http://localhost/families/family-1/meal-plans", formData?: FormData) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family meal plans route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads serialized family meal plans for the current family", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(listMealPlansForFamily).mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      mealPlans: [
        {
          activeShoppingDate: new Date("2026-05-15T00:00:00.000Z"),
          createdAt: new Date("2026-05-01T12:00:00.000Z"),
          endDate: new Date("2026-05-18T00:00:00.000Z"),
          id: "meal-plan-1",
          startDate: new Date("2026-05-15T00:00:00.000Z"),
          status: "DRAFT",
          title: "Langhelg",
          updatedAt: new Date("2026-05-01T12:00:00.000Z"),
        },
      ],
      userRole: "ADMIN",
    });

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans?notice=meal-plan-created"),
    });

    expect(listMealPlansForFamily).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result).toEqual({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      mealPlans: [
        {
          activeShoppingDate: "2026-05-15",
          createdAt: new Date("2026-05-01T12:00:00.000Z"),
          endDate: "2026-05-18",
          id: "meal-plan-1",
          startDate: "2026-05-15",
          status: "DRAFT",
          title: "Langhelg",
          updatedAt: new Date("2026-05-01T12:00:00.000Z"),
        },
      ],
      notice: "meal-plan-created",
    });
  });

  it("returns create validation errors from the server module", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(createMealPlan).mockResolvedValue({
      fieldErrors: {
        endDate: "Datointervallet kan være maks 7 dager.",
      },
      status: "VALIDATION_ERROR",
      values: {
        endDate: "2026-05-20",
        startDate: "2026-05-12",
        title: "Uke 20",
      },
    });

    const formData = new FormData();
    formData.set("intent", "create-meal-plan");
    formData.set("title", "Uke 20");
    formData.set("startDate", "2026-05-12");
    formData.set("endDate", "2026-05-20");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans", formData),
    });

    expect(createMealPlan).toHaveBeenCalledWith({
      endDate: "2026-05-20",
      familyId: "family-1",
      startDate: "2026-05-12",
      title: "Uke 20",
      userId: "user-1",
    });
    expect(result).toEqual({
      fieldErrors: {
        endDate: "Datointervallet kan være maks 7 dager.",
      },
      intent: "create-meal-plan",
      values: {
        endDate: "2026-05-20",
        sourceMealPlanId: "",
        startDate: "2026-05-12",
        title: "Uke 20",
      },
    });
  });

  it("returns copy validation errors while preserving the selected source meal plan", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(copyMealPlan).mockResolvedValue({
      fieldErrors: {
        title: "Skriv inn et navn for ukeplanen.",
      },
      status: "VALIDATION_ERROR",
      values: {
        endDate: "2026-05-22",
        startDate: "2026-05-20",
        title: "",
      },
    });

    const formData = new FormData();
    formData.set("intent", "create-meal-plan");
    formData.set("title", " ");
    formData.set("startDate", "2026-05-20");
    formData.set("endDate", "2026-05-22");
    formData.set("sourceMealPlanId", "meal-plan-source");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans", formData),
    });

    expect(copyMealPlan).toHaveBeenCalledWith({
      endDate: "2026-05-22",
      familyId: "family-1",
      sourceMealPlanId: "meal-plan-source",
      startDate: "2026-05-20",
      title: " ",
      userId: "user-1",
    });
    expect(createMealPlan).not.toHaveBeenCalled();
    expect(result).toEqual({
      fieldErrors: {
        title: "Skriv inn et navn for ukeplanen.",
      },
      intent: "create-meal-plan",
      values: {
        endDate: "2026-05-22",
        sourceMealPlanId: "meal-plan-source",
        startDate: "2026-05-20",
        title: "",
      },
    });
  });

  it("redirects with a notice after creating a meal plan", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(createMealPlan).mockResolvedValue({
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
        id: "meal-plan-1",
        startDate: new Date("2026-05-15T00:00:00.000Z"),
        status: "DRAFT",
        title: "Langhelg",
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
      },
      status: "CREATED",
    });

    const formData = new FormData();
    formData.set("intent", "create-meal-plan");
    formData.set("title", "Langhelg");
    formData.set("startDate", "2026-05-15");
    formData.set("endDate", "2026-05-18");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans", formData),
    });

    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1/meal-plans?notice=meal-plan-created",
    );
  });

  it("redirects with a copy notice after reusing an existing meal plan", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(copyMealPlan).mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      mealPlan: {
        activeShoppingDate: new Date("2026-05-20T00:00:00.000Z"),
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
      },
      status: "CREATED",
    });

    const formData = new FormData();
    formData.set("intent", "create-meal-plan");
    formData.set("title", "Neste uke");
    formData.set("startDate", "2026-05-20");
    formData.set("endDate", "2026-05-22");
    formData.set("sourceMealPlanId", "meal-plan-source");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans", formData),
    });

    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1/meal-plans?notice=meal-plan-copied",
    );
  });

  it("returns a create-form error when the selected source meal plan no longer exists", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(copyMealPlan).mockResolvedValue({
      status: "NOT_FOUND",
    });

    const formData = new FormData();
    formData.set("intent", "create-meal-plan");
    formData.set("title", "Neste uke");
    formData.set("startDate", "2026-05-20");
    formData.set("endDate", "2026-05-22");
    formData.set("sourceMealPlanId", "meal-plan-source");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans", formData),
    });

    expect(result).toEqual({
      formError: "Fant ikke ukeplanen du ville gjenbruke. Velg en annen ukeplan og prov igjen.",
      intent: "create-meal-plan",
      values: {
        endDate: "2026-05-22",
        sourceMealPlanId: "meal-plan-source",
        startDate: "2026-05-20",
        title: "Neste uke",
      },
    });
  });

  it("returns a delete error when the meal plan no longer exists", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(deleteMealPlan).mockResolvedValue({
      status: "NOT_FOUND",
    });

    const formData = new FormData();
    formData.set("intent", "delete-meal-plan");
    formData.set("mealPlanId", "meal-plan-404");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1/meal-plans", formData),
    });

    expect(result).toEqual({
      formError: "Fant ikke ukeplanen som skulle slettes.",
      intent: "delete-meal-plan",
      targetMealPlanId: "meal-plan-404",
    });
  });

  it("rethrows the login redirect for unauthenticated requests", async () => {
    const redirectResponse = new Response(null, {
      status: 302,
      headers: {
        Location: "/login?redirectTo=%2Ffamilies%2Ffamily-1%2Fmeal-plans",
      },
    });

    vi.mocked(requireUser).mockRejectedValue(redirectResponse);

    await expect(
      loader({
        params: {
          familyId: "family-1",
        },
        request: buildRequest(),
      }),
    ).rejects.toBe(redirectResponse);
  });
});
